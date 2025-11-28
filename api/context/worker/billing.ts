import { getMollieClient } from 'infra/mollie/mod.ts'
import { WorkerBillingContext } from '../mod.ts'
import { getQontoClient } from 'infra/qonto/mod.ts'

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
