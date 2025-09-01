import { z } from 'zod'
import { ServerRequest, ServerResponse } from '../../_common.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({
  autoPurchase: z.object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1),
    amount: z.number().int().min(1)
  }),
  usageLimits: z.object({
    enabled: z.boolean(),
    cpu: z.number().int().min(1),
    memory: z.number().int().min(1),
    storage: z.number().int().min(1),
    dailySpendLimit: z.number().int().min(1)
  })
})

export type Input = z.infer<typeof Input>

export interface UpdateSettingsResult {
  success: boolean
  message: string
}

export default async function* (
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<UpdateSettingsResult> {
  try {
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace
    
    yield `Updating billing settings...`
    
    // Get current namespace
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })
    
    // Prepare annotations for auto-purchase settings
    const annotations = {
      ...namespaceObj.metadata?.annotations,
      'ctnr.io/auto-purchase-enabled': input.autoPurchase.enabled.toString(),
      'ctnr.io/auto-purchase-threshold': input.autoPurchase.threshold.toString(),
      'ctnr.io/auto-purchase-amount': input.autoPurchase.amount.toString(),
      'ctnr.io/usage-limits-enabled': input.usageLimits.enabled.toString(),
      'ctnr.io/cpu-limit': input.usageLimits.cpu.toString(),
      'ctnr.io/memory-limit': input.usageLimits.memory.toString(),
      'ctnr.io/storage-limit': input.usageLimits.storage.toString(),
      'ctnr.io/daily-spend-limit': input.usageLimits.dailySpendLimit.toString()
    }
    
    // Update namespace with new annotations
    await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
      metadata: {
        annotations
      }
    }, {
      abortSignal: signal,
    })
    
    yield `Billing settings updated successfully`
    
    return {
      success: true,
      message: 'Billing settings updated successfully'
    }
  } catch (error: any) {
    console.error('Failed to update billing settings:', error)
    
    return {
      success: false,
      message: `Failed to update billing settings: ${error.message}`
    }
  }
}
