import { getMollieClient } from 'core/adapters/mollie/mod.ts'
import { WorkerBillingContext } from '../mod.ts'
import { getQontoClient } from 'core/adapters/qonto/mod.ts'

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
