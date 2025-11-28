import { WorkerContext } from '../mod.ts'
import { createVersionContext } from '../version.ts'
import { createBillingContext } from './billing.ts'
import { createWorkerKubeContext } from './kube.ts'

export async function createWorkerContext(_opts: object): Promise<WorkerContext> {
  const versionContext = await createVersionContext()
  const kubeContext = await createWorkerKubeContext()
  const billingContext = await createBillingContext()
  return {
    __type: 'worker',
    ...versionContext,
    ...kubeContext,
    ...billingContext,
  }
}
