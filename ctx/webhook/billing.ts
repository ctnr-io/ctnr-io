import { getMollieClient } from 'lib/billing/mollie.ts'
import { BillingWebhookContext } from '../mod.ts'
import { getQontoClient } from 'lib/billing/qonto/mod.ts'

export function createBillingContext(): BillingWebhookContext {
  return {
    billing: {
      client: {
        mollie: getMollieClient(),
        qonto: getQontoClient(),
      },
    },
  }
}
