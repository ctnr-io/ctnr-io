import { getMollieClient } from 'lib/billing/mollie.ts'
import { WorkerBillingContext } from '../mod.ts'
import { getQontoClient } from 'lib/billing/qonto/mod.ts'

export function createBillingContext(): WorkerBillingContext {
  return {
    billing: {
      client: {
        mollie: getMollieClient(),
        qonto: getQontoClient(),
      },
    },
  }
}
