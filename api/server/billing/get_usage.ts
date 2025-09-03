import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { parseResourceValue, calculateCost } from 'lib/billing/utils.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export const Output = z.object({})

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

export type BalanceStatus = 'normal' | 'limit_reached' | 'insufficient_credits' | 'free_tier'

export interface Output {
  // Credit information
  credits: {
    balance: number
    currency: string
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
  
  // Status information
  status: BalanceStatus
  
  // Tier information
  tier: {
    type: 'free' | 'paid'
    limits: {
      cpu: number
      memory: number
      storage: number
    }
  }
}

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<Output> {
  try {
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace
    
    // Get namespace to check credits and tier
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })
    
    const annotations = namespaceObj.metadata?.annotations || {}
    const creditsAnnotation = annotations['ctnr.io/credits']
    
    // Parse credits
    let credits = 0
    if (creditsAnnotation) {
      const parsed = parseInt(creditsAnnotation, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        credits = parsed
      }
    }
    
    // Get tier limits
    const resourceQuota = await kubeClient.KarmadaV1Alpha1(namespace).getFederatedResourceQuota('ctnr-resource-quota', {
      abortSignal: signal,
    })
    const limits = {
      cpu: parseResourceValue(resourceQuota.spec?.overall['limits.cpu'], 'cpu'),
      memory: parseResourceValue(resourceQuota.spec?.overall['limits.memory'], 'memory'),
      storage: parseResourceValue(resourceQuota.spec?.overall['limits.storage'], 'storage'),
    }
    
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

    // Determine status
    let status: BalanceStatus = 'normal'
    
    if (credits === 0) {
      status = 'free_tier'
    } else {
      // Check if any resource limit is reached (>= 95%)
      const resourceLimitReached = usage.cpu.percentage >= 95 || 
                                   usage.memory.percentage >= 95 || 
                                   usage.storage.percentage >= 95
      
      if (resourceLimitReached) {
        status = 'limit_reached'
      } else if (totalCost.daily > 0 && credits < totalCost.daily * 2) {
        // If daily cost > 0 and credits < 2 days worth
        status = 'insufficient_credits'
      }
    }

    // Determine tier
    const tier = {
      type: credits > 0 ? 'paid' : 'free' as 'free' | 'paid',
      limits: {
        cpu: limits.cpu,
        memory: limits.memory,
        storage: limits.storage
      }
    }
    
    const result: Output = {
      credits: {
        balance: credits,
        currency: 'credits'
      },
      usage,
      costs: totalCost,
      containers,
      status,
      tier
    }
    
    return result
  } catch (error) {
    console.error('Failed to get usage data:', error)
    
    // Fallback response
    const fallbackLimits = {
      cpu: 1000,
      memory: 2048,
      storage: 10
    }
    const fallbackResult: Output = {
      credits: {
        balance: 0,
        currency: 'credits'
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
      containers: [],
      status: 'free_tier',
      tier: {
        type: 'free',
        limits: fallbackLimits
      }
    }
    
    return fallbackResult
  }
}
