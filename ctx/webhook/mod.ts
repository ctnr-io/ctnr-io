import { WebhookContext } from '../mod.ts'
import { createBillingContext } from './billing.ts'
import { createKubeServerWebhookContext } from './kube.ts'

export async function createWebhookContext(_opts: object): Promise<WebhookContext> {
  const kubeContext = await createKubeServerWebhookContext()
  const billingContext = await createBillingContext()
  return {
    __type: 'webhook',
    ...kubeContext,
    ...billingContext,
  }
}
