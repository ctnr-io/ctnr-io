import { z } from 'zod'
import { ServerRequest, ServerResponse } from '../../_common.ts'
import { parseResourceValue, Tier, TierLimits } from 'lib/billing/utils.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export type BalanceStatus = 'normal' | 'limit_reached' | 'insufficient_credits' | 'free_tier'

export interface CheckBalanceResult {
  credits: {
    balance: number
    currency: string
  }
  updated: boolean
  previousBalance?: number
  status: BalanceStatus
  usage?: {
    cpu: { used: number; limit: number; percentage: number }
    memory: { used: number; limit: number; percentage: number }
    storage: { used: number; limit: number; percentage: number }
  }
  costs?: {
    hourly: number
    daily: number
    monthly: number
  }
}

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<CheckBalanceResult> {
  try {
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace
    
    // Get current namespace to check credits and tier
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })
    
    const annotations = namespaceObj.metadata?.annotations || {}
    const creditsAnnotation = annotations['ctnr.io/credits'] || annotations['ctnr.io/credit-balance']
    const tierAnnotation = (annotations['ctnr.io/tier'] || 'free') as keyof typeof Tier
    
    // Parse current credits
    let currentCredits = 0
    if (creditsAnnotation) {
      const parsed = parseInt(creditsAnnotation, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        currentCredits = parsed
      }
    }
    
    // Get tier limits
    const limits = Tier[tierAnnotation]
    
    // Get all deployments to calculate current resource usage
    const deployments = await kubeClient.AppsV1.namespace(namespace).getDeploymentList({
      labelSelector: 'ctnr.io/name',
      abortSignal: signal,
    })
    
    let totalHourlyCost = 0
    let totalCpuUsed = 0
    let totalMemoryUsed = 0
    let totalStorageUsed = 0
    
    // Calculate current resource usage and hourly cost based on running containers
    for (const deployment of deployments.items) {
      const container = deployment.spec?.template?.spec?.containers?.[0]
      const replicas = deployment.status?.readyReplicas || 0
      
      if (container && replicas > 0) {
        const cpuRequest = container.resources?.limits?.cpu || '100m'
        const memoryRequest = container.resources?.limits?.memory || '128Mi'
        const storageRequest = container.resources?.limits?.['ephemeral-storage'] || '1Gi'

        // Simple cost calculation (adjust these rates as needed)
        // CPU: 0.1 credits per millicpu per hour
        // Memory: 0.05 credits per MB per hour  
        // Storage: 0.01 credits per GB per hour
        const cpuString = typeof cpuRequest === 'string' ? cpuRequest : cpuRequest.serialize()
        const memoryString = typeof memoryRequest === 'string' ? memoryRequest : memoryRequest.serialize()
        const storageString = typeof storageRequest === 'string' ? storageRequest : storageRequest.serialize()
        
        const cpuMillicores = parseResourceValue(cpuString, 'cpu')
        const memoryMB = parseResourceValue(memoryString, 'memory')
        const storageGB = parseResourceValue(storageString, 'storage')
        
        totalCpuUsed += cpuMillicores * replicas
        totalMemoryUsed += memoryMB * replicas
        totalStorageUsed += storageGB * replicas
        
        const containerHourlyCost = (
          (cpuMillicores * 0.1) + 
          (memoryMB * 0.05) + 
          (storageGB * 0.01)
        ) * replicas
        
        totalHourlyCost += containerHourlyCost
      }
    }
    
    // Get storage usage from PVCs
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
    
    // Calculate costs
    const costs = {
      hourly: totalHourlyCost,
      daily: totalHourlyCost * 24,
      monthly: totalHourlyCost * 24 * 30
    }
    
    // Check if we need to deduct credits (only if there are running containers)
    let updated = false
    let previousBalance = currentCredits
    
    if (totalHourlyCost > 0 && currentCredits > 0) {
      // Get last check timestamp
      const lastCheckAnnotation = annotations['ctnr.io/last-balance-check']
      const lastCheck = lastCheckAnnotation ? parseInt(lastCheckAnnotation, 10) : Date.now()
      const now = Date.now()
      
      // Calculate hours since last check (minimum 1 minute intervals)
      const hoursSinceLastCheck = Math.max((now - lastCheck) / (1000 * 60 * 60), 1/60)
      
      // Calculate credits to deduct
      const creditsToDeduct = Math.ceil(totalHourlyCost * hoursSinceLastCheck)
      
      if (creditsToDeduct > 0) {
        const newBalance = Math.max(0, currentCredits - creditsToDeduct)
        
        // Update namespace annotations
        const updatedAnnotations = {
          ...annotations,
          'ctnr.io/credits': newBalance.toString(),
          'ctnr.io/credit-balance': newBalance.toString(),
          'ctnr.io/last-balance-check': now.toString(),
        }
        
        await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
          metadata: {
            annotations: updatedAnnotations
          }
        })
        
        currentCredits = newBalance
        updated = true
        
        console.log(`Updated credits for ${namespace}: ${previousBalance} -> ${newBalance} (deducted ${creditsToDeduct})`)
      }
    } else if (totalHourlyCost === 0) {
      // Update last check timestamp even if no containers are running
      const updatedAnnotations = {
        ...annotations,
        'ctnr.io/last-balance-check': Date.now().toString(),
      }
      
      await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
        metadata: {
          annotations: updatedAnnotations
        }
      })
    }
    
    // Determine status based on resource usage and credit balance
    let status: BalanceStatus = 'normal'
    
    // Check if resource limits are reached (>= 100%)
    const isLimitReached = usage.cpu.percentage >= 100 || usage.memory.percentage >= 100 || usage.storage.percentage >= 100
    
    if (isLimitReached) {
      status = 'limit_reached'
    } else if (tierAnnotation === 'free') {
      status = 'free_tier'
    } else if (currentCredits > 0 && costs.daily > 0 && currentCredits < costs.daily) {
      // Insufficient credits if balance is less than daily usage
      status = 'insufficient_credits'
    }
    
    const result: CheckBalanceResult = {
      credits: {
        balance: currentCredits,
        currency: 'credits'
      },
      updated,
      status,
      usage,
      costs,
      ...(updated && { previousBalance })
    }
    
    return result
  } catch (error) {
    console.error('Failed to check balance:', error)
    
    // Return current balance without updates on error
    const fallbackResult: CheckBalanceResult = {
      credits: {
        balance: 0,
        currency: 'credits'
      },
      updated: false,
      status: 'normal'
    }
    
    return fallbackResult
  }
}
