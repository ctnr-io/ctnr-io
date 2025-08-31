import { z } from 'zod'
import { ServerRequest, ServerResponse } from '../../_common.ts'
import { parseResourceValue, calculateCost, calculateCosts, Tier, TierLimits} from 'lib/billing/utils.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export interface Container {
  name: string
  cpu: string
  memory: string
  storage: string
  replicas: number
  costs: {
    hourly: number
    daily: number
    monthly: number
  }
}

export interface UsageData {
  // Credit information
  credits: {
    balance: number
    currency: string
  }
  
  // Tier information
  tier: {
    type: Tier
    limits: TierLimits
  }
  
  // Current resource usage
  usage: {
    cpu: { used: number; limit: number; percentage: number }
    memory: { used: number; limit: number; percentage: number }
    storage: { used: number; limit: number; percentage: number }
  }
  
  // Cost information
  costs: {
    hourly: number
    daily: number
    monthly: number
  }
  
  // Container breakdown
  containers: Container[]
}

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<UsageData> {
  try {
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace
    
    // Get namespace to check credits and tier
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })
    
    const annotations = namespaceObj.metadata?.annotations || {}
    const tierAnnotation = (annotations['ctnr.io/tier'] || 'free') as Tier
    const creditsAnnotation = annotations['ctnr.io/credits'] || annotations['ctnr.io/credit-balance']
    
    // Parse credits
    let credits = 0
    if (creditsAnnotation) {
      const parsed = parseInt(creditsAnnotation, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        credits = parsed
      }
    }
    
    // Get tier limits
    const tierKey = tierAnnotation as Tier
    const limits = Tier[tierKey] 
    
    // Get all deployments
    const deployments = await kubeClient.AppsV1.namespace(namespace).getDeploymentList({
      labelSelector: 'ctnr.io/name',
      abortSignal: signal,
    })
    
    let totalCpuUsed = 0
    let totalMemoryUsed = 0
    let totalStorageUsed = 0
    let totalCost = {
      hourly: 0,
      daily: 0,
      monthly: 0
    }
    const containers: Container[] = []
    
    // Process each deployment
    for (const deployment of deployments.items) {
      const container = deployment.spec?.template?.spec?.containers?.[0]
      const replicas = deployment.status?.readyReplicas || 0
      const name = deployment.metadata?.name || 'unknown'
      
      if (container && replicas > 0) {
        const cpuRequest = container.resources?.limits?.cpu || '100m'
        const memoryRequest = container.resources?.limits?.memory || '128Mi'
        const storageRequest = container.resources?.limits?.['ephemeral-storage'] || '1Gi'

        const cpuString = typeof cpuRequest === 'string' ? cpuRequest : cpuRequest.serialize()
        const memoryString = typeof memoryRequest === 'string' ? memoryRequest : memoryRequest.serialize()
        const storageString = typeof storageRequest === 'string' ? storageRequest : storageRequest.serialize()

        // Calculate resource usage
        const cpuMillicores = parseResourceValue(cpuString, 'cpu')
        const memoryMB = parseResourceValue(memoryString, 'memory')
        const storageGB = parseResourceValue(storageString, 'storage')

        totalCpuUsed += cpuMillicores * replicas
        totalMemoryUsed += memoryMB * replicas
        totalStorageUsed += storageGB * replicas

        // Calculate costs for this container
        const costs = calculateCost(cpuString, memoryString, storageString, replicas)
        totalCost = {
          hourly: totalCost.hourly + costs.hourly,
          daily: totalCost.daily + costs.daily,
          monthly: totalCost.monthly + costs.monthly
        }

        containers.push({
          name,
          cpu: cpuString,
          memory: memoryString,
          storage: storageString,
          replicas,
          costs
        })
      }
    }
    
    // Get storage usage
    try {
      const pvcs = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaimList({
        abortSignal: signal,
      })
      
      for (const pvc of pvcs.items) {
        const storageRequest = pvc.spec?.resources?.requests?.storage || '0Gi'
        totalStorageUsed += parseResourceValue(storageRequest, 'storage')
      }
    } catch (error) {
      console.warn('Failed to fetch storage usage:', error)
    }

    // Calculate usage percentages
    const usage = {
      cpu: {
        used: totalCpuUsed,
        limit: limits.cpu,
        percentage: limits.cpu === Infinity ? 0 : Math.round((totalCpuUsed / limits.cpu) * 100)
      },
      memory: {
        used: totalMemoryUsed,
        limit: limits.memory,
        percentage: limits.memory === Infinity ? 0 : Math.round((totalMemoryUsed / limits.memory) * 100)
      },
      storage: {
        used: totalStorageUsed,
        limit: limits.storage,
        percentage: limits.storage === Infinity ? 0 : Math.round((totalStorageUsed / limits.storage) * 100)
      }
    }
    
    const result: UsageData = {
      credits: {
        balance: credits,
        currency: 'credits'
      },
      tier: {
        type: tierAnnotation,
        limits: {
          cpu: limits.cpu,
          memory: limits.memory,
          storage: Math.round(limits.storage / 1024), // Convert MB to GB
          monthlyCreditCost: limits.monthlyCreditCost
        }
      },
      usage,
      costs: totalCost,
      containers
    }
    
    return result
  } catch (error) {
    console.error('Failed to get usage data:', error)
    
    // Fallback response
    const fallbackLimits = Tier.free
    const fallbackResult: UsageData = {
      credits: {
        balance: 0,
        currency: 'credits'
      },
      tier: {
        type: 'free',
        limits: {
          cpu: fallbackLimits.cpu,
          memory: fallbackLimits.memory,
          storage: Math.round(fallbackLimits.storage / 1024), // Convert MB to GB
          monthlyCreditCost: fallbackLimits.monthlyCreditCost
        }
      },
      usage: {
        cpu: { used: 0, limit: fallbackLimits.cpu, percentage: 0 },
        memory: { used: 0, limit: fallbackLimits.memory, percentage: 0 },
        storage: { used: 0, limit: fallbackLimits.storage, percentage: 0 },
      },
      costs: {
        hourly: 0,
        daily: 0,
        monthly: 0
      },
      containers: []
    }
    
    return fallbackResult
  }
}
