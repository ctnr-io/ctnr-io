import { getMollieClient } from 'infra/mollie/mod.ts'
import { WebhookBillingContext } from '../mod.ts'
import { getQontoClient } from 'infra/qonto/mod.ts'

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
