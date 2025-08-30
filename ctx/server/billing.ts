import { getMollieClient } from 'lib/billing/mollie.ts'
import { BillingContext } from '../mod.ts'

export function createBillingContext(): BillingContext {
  return {
    billing: {
      client: getMollieClient(),
      webhookUrl: '/api/billing/webhook'
    }
  }
}
