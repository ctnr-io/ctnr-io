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

export default async function* ({ ctx, input }: WebhookRequest<Input>): WebhookResponse<Output> {
  try {
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
      const subscriptionType = metadata?.subscriptionType

      if (!userId) {
        console.error(`Invalid metadata for payment ${paymentId}: missing userId`, payment.metadata)
        return new Response('Invalid payment metadata', { status: 400 })
      }

      // Handle tier subscription payments
      if (subscriptionType === 'tier') {
        const tier = metadata?.tier
        if (!tier) {
          console.error(`Invalid tier subscription metadata for payment ${paymentId}:`, payment.metadata)
          return new Response('Invalid tier subscription metadata', { status: 400 })
        }

        console.log(`Tier subscription payment ${paymentId} confirmed: Upgrading user ${userId} to ${tier} tier`)

        try {
          // Update the user's tier in Kubernetes namespace
          const kubeClient = ctx.kube.client['eu']
          const namespace = 'ctnr-user' + userId

          // Get the current namespace object
          const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace)

          // Update the namespace annotations with the new tier
          const annotations = namespaceObj.metadata?.annotations || {}
          annotations['ctnr.io/tier'] = tier

          // Update the namespace
          await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
            metadata: {
              annotations,
            },
          }, {})

          console.log(`Successfully upgraded user ${userId} to ${tier} tier`)
        } catch (error) {
          console.error(`Failed to upgrade user ${userId} to ${tier} tier:`, error)
          return new Response('Failed to upgrade tier', { status: 500 })
        }
      } else {
        // Handle credit purchases
        const credits = parseInt(metadata?.credits || '0')
        if (!credits) {
          console.error(`Invalid credit purchase metadata for payment ${paymentId}:`, payment.metadata)
          return new Response('Invalid credit purchase metadata', { status: 400 })
        }

        console.log(`Credit purchase payment ${paymentId} confirmed: Adding ${credits} credits to user ${userId}`)

        try {
          // Update the user's credit balance in Kubernetes namespace
          const kubeClient = ctx.kube.client['eu']
          const namespace = 'ctnr-user' + userId

          // Get the current namespace object
          const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace)

          // Get current credit balance from annotations
          const annotations = namespaceObj.metadata?.annotations || {}
          const currentCredits = parseInt(annotations['ctnr.io/credits'] || annotations['ctnr.io/credit-balance'] || '0')
          const newCreditBalance = currentCredits + credits

          // Update the namespace annotations with the new credit balance
          annotations['ctnr.io/credits'] = newCreditBalance.toString()
          annotations['ctnr.io/credit-balance'] = newCreditBalance.toString()

          // Update the namespace
          await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
            metadata: {
              annotations,
            },
          }, {})

          console.log(`Successfully added ${credits} credits to user ${userId}. New balance: ${newCreditBalance}`)
        } catch (error) {
          console.error(`Failed to add credits to user ${userId}:`, error)
          return new Response('Failed to add credits', { status: 500 })
        }
      }
    } else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
      console.log(`Payment ${paymentId} failed with status: ${payment.status}`)
      
      // Handle failed tier subscription payments
      const metadata = payment.metadata as Record<string, string> | undefined
      const userId = metadata?.userId
      const subscriptionType = metadata?.subscriptionType

      if (userId && subscriptionType === 'tier') {
        console.log(`Tier subscription payment ${paymentId} failed: Reverting user ${userId} to free tier`)
        
        try {
          // Revert the user's tier to free in Kubernetes namespace
          const kubeClient = ctx.kube.client['eu']
          const namespace = 'ctnr-user' + userId

          // Get the current namespace object
          const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace)

          // Update the namespace annotations to free tier
          const annotations = namespaceObj.metadata?.annotations || {}
          annotations['ctnr.io/tier'] = 'free'

          // Update the namespace
          await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
            metadata: {
              annotations,
            },
          }, {})

          console.log(`Successfully reverted user ${userId} to free tier due to failed payment`)
        } catch (error) {
          console.error(`Failed to revert user ${userId} to free tier:`, error)
          // Don't return error response here as the payment failure is already handled
        }
      }
    } else {
      console.log(`Payment ${paymentId} has status: ${payment.status}`)
      
      // Handle other payment statuses for tier subscriptions
      const metadata = payment.metadata as Record<string, string> | undefined
      const userId = metadata?.userId
      const subscriptionType = metadata?.subscriptionType

      if (userId && subscriptionType === 'tier') {
        console.log(`Tier subscription payment ${paymentId} has status ${payment.status}: Reverting user ${userId} to free tier`)
        
        try {
          // Revert the user's tier to free in Kubernetes namespace
          const kubeClient = ctx.kube.client['eu']
          const namespace = 'ctnr-user' + userId

          // Get the current namespace object
          const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace)

          // Update the namespace annotations to free tier
          const annotations = namespaceObj.metadata?.annotations || {}
          annotations['ctnr.io/tier'] = 'free'

          // Update the namespace
          await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
            metadata: {
              annotations,
            },
          }, {})

          console.log(`Successfully reverted user ${userId} to free tier due to payment status: ${payment.status}`)
        } catch (error) {
          console.error(`Failed to revert user ${userId} to free tier:`, error)
          // Don't return error response here as this is not a critical failure
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
