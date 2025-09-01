import { z } from 'zod'
import { ServerRequest, ServerResponse } from '../../_common.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export interface BillingSettings {
  autoPurchase: {
    enabled: boolean
    threshold: number
    amount: number
  }
  usageLimits: {
    enabled: boolean
    cpu: number
    memory: number
    storage: number
    dailySpendLimit: number
  }
}

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<BillingSettings> {
  try {
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace
    
    // Get namespace to check billing settings annotations
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })
    
    const annotations = namespaceObj.metadata?.annotations || {}
    
    // Parse auto-purchase settings
    const autoPurchaseEnabled = annotations['ctnr.io/auto-purchase-enabled'] === 'true'
    const autoPurchaseThreshold = parseInt(annotations['ctnr.io/auto-purchase-threshold'] || '100', 10)
    const autoPurchaseAmount = parseInt(annotations['ctnr.io/auto-purchase-amount'] || '500', 10)
    
    // Parse usage limits settings
    const usageLimitsEnabled = annotations['ctnr.io/usage-limits-enabled'] === 'true'
    const cpuLimit = parseInt(annotations['ctnr.io/cpu-limit'] || '2', 10)
    const memoryLimit = parseInt(annotations['ctnr.io/memory-limit'] || '4', 10)
    const storageLimit = parseInt(annotations['ctnr.io/storage-limit'] || '10', 10)
    const dailySpendLimit = parseInt(annotations['ctnr.io/daily-spend-limit'] || '10', 10)
    
    const result: BillingSettings = {
      autoPurchase: {
        enabled: autoPurchaseEnabled,
        threshold: autoPurchaseThreshold,
        amount: autoPurchaseAmount
      },
      usageLimits: {
        enabled: usageLimitsEnabled,
        cpu: cpuLimit,
        memory: memoryLimit,
        storage: storageLimit,
        dailySpendLimit: dailySpendLimit
      }
    }
    
    return result
  } catch (error) {
    console.error('Failed to get billing settings:', error)
    
    // Fallback response
    return {
      autoPurchase: {
        enabled: false,
        threshold: 100,
        amount: 500
      },
      usageLimits: {
        enabled: false,
        cpu: 2,
        memory: 4,
        storage: 10,
        dailySpendLimit: 10
      }
    }
  }
}
