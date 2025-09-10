import { WorkerContext } from '../mod.ts'
import { createBillingContext } from './billing.ts'
import { createKubeServerWorkerContext } from './kube.ts'

export async function createWorkerContext(_opts: object): Promise<WorkerContext> {
  const kubeContext = await createKubeServerWorkerContext()
  const billingContext = await createBillingContext()
  return {
    __type: 'worker',
    ...kubeContext,
    ...billingContext,
  }
}
