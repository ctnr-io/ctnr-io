import { z } from 'zod'
import { ServerRequest, ServerResponse } from '../../_common.ts'
import { parseResourceValue } from 'lib/billing/utils.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export interface CheckBalanceResult {
  credits: {
    balance: number
    currency: string
  }
  updated: boolean
  previousBalance?: number
}

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<CheckBalanceResult> {
  try {
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace
    
    // Get current namespace to check credits
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })
    
    const annotations = namespaceObj.metadata?.annotations || {}
    const creditsAnnotation = annotations['ctnr.io/credits'] || annotations['ctnr.io/credit-balance']
    
    // Parse current credits
    let currentCredits = 0
    if (creditsAnnotation) {
      const parsed = parseInt(creditsAnnotation, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        currentCredits = parsed
      }
    }
    
    // Get all deployments to calculate current resource usage
    const deployments = await kubeClient.AppsV1.namespace(namespace).getDeploymentList({
      labelSelector: 'ctnr.io/name',
      abortSignal: signal,
    })
    
    let totalHourlyCost = 0
    
    // Calculate current hourly cost based on running containers
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
        
        const containerHourlyCost = (
          (cpuMillicores * 0.1) + 
          (memoryMB * 0.05) + 
          (storageGB * 0.01)
        ) * replicas
        
        totalHourlyCost += containerHourlyCost
      }
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
    
    const result: CheckBalanceResult = {
      credits: {
        balance: currentCredits,
        currency: 'credits'
      },
      updated,
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
      updated: false
    }
    
    return fallbackResult
  }
}
