import { WebhookContext } from '../mod.ts'
import { createBillingContext } from '../server/billing.ts'
import { createKubeServerWebhookContext } from './kube.ts'

export async function createWebhookContext(opts: {}): Promise<WebhookContext> {
  const kubeContext = await createKubeServerWebhookContext()
  const billingContext = await createBillingContext()
  return {
    __type: 'webhook',
    ...kubeContext,
    ...billingContext,
  }
}