import { getMollieClient } from 'core/adapters/mollie/mod.ts'
import { WebhookBillingContext } from '../mod.ts'
import { getQontoClient } from 'core/adapters/qonto/mod.ts'

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
