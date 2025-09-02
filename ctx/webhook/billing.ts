import { getMollieClient } from 'lib/billing/mollie.ts'
import { BillingWebhookContext } from '../mod.ts'

export function createBillingContext(): BillingWebhookContext {
  // Retrieve billing customerId from namespace label or create customer 
  const client = getMollieClient()
  return {
    billing: {
      client,
      webhookUrl: '/api/billing/webhook',
    }
  }
}
