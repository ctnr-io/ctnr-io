import { z } from 'zod'
import { ServerContext } from 'ctx/mod.ts'
import { ServerRequest, ServerResponse } from '../../_common.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({
  amount: z.number().min(0).describe('Amount of credits to deduct'),
  reason: z.string().optional().describe('Reason for deduction (e.g., "hourly usage")'),
})

export type Input = z.infer<typeof Input>

export interface CreditDeduction {
  success: boolean
  previousBalance: number
  newBalance: number
  deductedAmount: number
  reason?: string
  timestamp: string
}

export default async function* (
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<CreditDeduction> {
  try {
    const { amount, reason } = input
    const kubeClient = ctx.kube.client['eu']
    const namespace = ctx.kube.namespace

    // Get current credits from namespace
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })

    const annotations = namespaceObj.metadata?.annotations || {}
    const creditsAnnotation = annotations['ctnr.io/credits'] || annotations['ctnr.io/credit-balance']

    let currentCredits = 0
    if (creditsAnnotation) {
      const parsed = parseInt(creditsAnnotation, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        currentCredits = parsed
      }
    }

    // Calculate new balance (don't go below 0)
    const newBalance = Math.max(0, currentCredits - amount)
    const actualDeducted = currentCredits - newBalance

    // Update namespace with new balance
    await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
      metadata: {
        annotations: {
          ...annotations,
          'ctnr.io/credits': newBalance.toString(),
          'ctnr.io/credit-balance': newBalance.toString(),
          'ctnr.io/last-deduction': new Date().toISOString(),
          'ctnr.io/last-deduction-amount': actualDeducted.toString(),
          'ctnr.io/last-deduction-reason': reason || 'usage',
        },
      },
    }, {
      abortSignal: signal,
    })

    return {
      success: true,
      previousBalance: currentCredits,
      newBalance,
      deductedAmount: actualDeducted,
      reason,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Failed to deduct credits:', error)
    return {
      success: false,
      previousBalance: 0,
      newBalance: 0,
      deductedAmount: 0,
      reason: input.reason,
      timestamp: new Date().toISOString(),
    }
  }
}
