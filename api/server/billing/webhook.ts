import { getMollieClient } from 'lib/billing/mollie.ts'
import { WebhookRequest, WebhookResponse } from '../../_common.ts'
import z from 'zod'

export const Meta = {
  title: 'Billing Webhook',
  description: 'Handles billing webhooks from Mollie',
}

export const Input = z.object({
  id: z.string(),
})

export type Input = z.infer<typeof Input>

export type Output = Response

export default async function* ({ input }: WebhookRequest<Input>): WebhookResponse<Output> {
  try {
    // Get payment ID from the request body
    const paymentId = input.id

    if (!paymentId) {
      console.error('No payment ID provided in webhook')
      return new Response('Bad Request', { status: 400 })
    }

    // Initialize Mollie client
    const mollieClient = getMollieClient()

    // Fetch payment details from Mollie
    const payment = await mollieClient.payments.get(paymentId)

    if (!payment) {
      console.error(`Payment not found: ${paymentId}`)
      return new Response('Payment not found', { status: 404 })
    }

    // Process payment based on status
    if (payment.status === 'paid') {
      const metadata = payment.metadata as Record<string, string> | undefined
      const userId = metadata?.userId
      const credits = parseInt(metadata?.credits || '0')

      if (!userId || !credits) {
        console.error(`Invalid metadata for payment ${paymentId}:`, payment.metadata)
        return new Response('Invalid payment metadata', { status: 400 })
      }

      console.log(`Payment ${paymentId} confirmed: Adding ${credits} credits to user ${userId}`)

      // TODO: Add credits to user account in database
      // This would typically involve updating the user's credit balance
      // Example: await updateUserCredits(userId, credits)
    } else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
      console.log(`Payment ${paymentId} failed with status: ${payment.status}`)
    } else {
      console.log(`Payment ${paymentId} has status: ${payment.status}`)
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
