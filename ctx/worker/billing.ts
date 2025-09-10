import { getMollieClient } from 'lib/billing/mollie.ts'
import { BillingWorkerContext } from '../mod.ts'
import { getQontoClient } from 'lib/billing/qonto/mod.ts'

export function createBillingContext(): BillingWorkerContext {
  return {
    billing: {
      client: {
        mollie: getMollieClient(),
        qonto: getQontoClient(),
      },
    },
  }
}
