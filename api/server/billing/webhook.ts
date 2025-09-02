import { WebhookRequest, WebhookResponse } from 'lib/api/types.ts'
import z from 'zod'
import { ensureUserNamespace } from 'lib/kubernetes/kube-client.ts'

export const Meta = {
  openapi: { method: 'POST', path: '/billing/handle-credits-payment' },
} as const

export const Input = z.object({
  id: z.string(),
})

export type Input = z.infer<typeof Input>

export type Output = Response

export default async function* ({ ctx, input }: WebhookRequest<Input>): WebhookResponse<Output> {
  // Get payment ID from the request body
  const paymentId = input.id

  if (!paymentId) {
    console.error('No payment ID provided in webhook')
    return new Response('Bad Request', { status: 400 })
  }

  // Fetch payment details from Mollie
  const payment = await ctx.billing.client.payments.get(paymentId)

  if (!payment) {
    console.error(`Payment not found: ${paymentId}`)
    return new Response('Payment not found', { status: 404 })
  }

  // Process payment based on status
  if (payment.status === 'paid') {
    const metadata = payment.metadata as Record<string, string> | undefined
    const userId = metadata?.userId

    if (!userId) {
      console.error(`Invalid metadata for payment ${paymentId}: missing userId`, payment.metadata)
      return new Response('Invalid payment metadata', { status: 400 })
    }

    const namespace = await ensureUserNamespace(ctx.kube.client['eu'], userId, new AbortSignal())

    const namespaceObj = await ctx.kube.client['eu'].CoreV1.getNamespace(namespace)

    // Handle successful payment
    console.info(`Payment ${paymentId} succeeded:`, payment)

    // Get current balance
    const currentBalanceAnnotation = namespaceObj.metadata?.annotations?.['ctnr.io/credits-balance']
    const currentBalance = parseInt(currentBalanceAnnotation || '0')

    console.info(`Current balance for user ${userId}:`, currentBalance)

    const addedBalance = Number(payment.amount.value) * 100
    const newBalance = currentBalance + addedBalance

    // Update the namespace
    await ctx.kube.client['eu'].CoreV1.patchNamespace(namespace, 'json-merge', {
      metadata: {
        annotations: {
          'ctnr.io/credits-balance': newBalance.toString(),
        },
      },
    })
    return new Response('Payment processed successfully')
  }
  return new Response('Payment not processed', { status: 400 })
}
