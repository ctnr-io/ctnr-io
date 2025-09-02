import { getMollieClient } from 'lib/billing/mollie.ts'
import { AuthServerContext, BillingServerContext, KubeServerContext } from '../mod.ts'

export async function createBillingContext(ctx: KubeServerContext & AuthServerContext, signal: AbortSignal): Promise<BillingServerContext> {
  // Retrieve billing customerId from namespace label or create customer 
  const client = getMollieClient()

  const namespace = await ctx.kube.client['eu'].CoreV1.getNamespace(`ctnr-user-${ctx.auth.user.id}`, { abortSignal: signal })
  const labels = namespace.metadata?.labels
  let customerId = labels?.['billing.ctnr.io/customer-id']
  if (!customerId) {
    // Create a new customer in Mollie
    const { id } = await client.customers.create({
      email: ctx.auth.user.email,
      metadata: {
        userId: ctx.auth.user.id,
      },
    })
    customerId = id
  }

  return {
    billing: {
      client,
      webhookUrl: '/api/billing/webhook',
      customerId,
    }
  }
}
