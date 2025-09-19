import { getMollieClient } from 'lib/billing/mollie.ts'
import { WebhookBillingContext } from '../mod.ts'
import { getQontoClient } from 'lib/billing/qonto/mod.ts'

export function createBillingContext(): WebhookBillingContext {
  return {
    billing: {
      client: {
        mollie: getMollieClient(),
        qonto: getQontoClient(),
      },
    },
  }
}
