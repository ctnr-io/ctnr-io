import { getMollieClient } from 'lib/billing/mollie.ts'
import { AuthServerContext, BillingServerContext, KubeServerContext } from '../mod.ts'
import { getQontoClient } from 'lib/billing/qonto/mod.ts'

export async function createBillingContext(
  ctx: KubeServerContext & AuthServerContext,
  signal: AbortSignal,
): Promise<BillingServerContext> {
  // Retrieve billing mollieCustomerId from namespace label or create customer
  const mollieClient = getMollieClient()
  const qontoClient = getQontoClient()

  const namespace = await ctx.kube.client['eu'].CoreV1.getNamespace(`ctnr-user-${ctx.auth.user.id}`, {
    abortSignal: signal,
  })
  const labels = namespace.metadata?.labels

  let mollieCustomerId = labels?.['ctnr.io/mollie-customer-id']
  if (!mollieCustomerId) {
    // Create a new customer in Mollie
    const { id } = await mollieClient.customers.create({
      email: ctx.auth.user.email,
      metadata: {
        userId: ctx.auth.user.id,
      },
    })
    mollieCustomerId = id
    await ctx.kube.client['eu'].CoreV1.patchNamespace(namespace.metadata!.name!, 'json-merge', {
      metadata: {
        labels: {
          'ctnr.io/mollie-customer-id': mollieCustomerId,
        },
      },
    })
  }

  let qontoClientId = labels?.['ctnr.io/qonto-client-id']
  if (!qontoClientId) {
    // Create a new client in Qonto
    const { client } = await qontoClient.createClient({
      first_name: 'John',
      last_name: 'Doe',
      type: 'individual',
      email: ctx.auth.user.email,
    })
    qontoClientId = client!.id!
    await ctx.kube.client['eu'].CoreV1.patchNamespace(namespace.metadata!.name!, 'json-merge', {
      metadata: {
        labels: {
          'ctnr.io/qonto-client-id': qontoClientId,
        },
      },
    })
  }

  return {
    billing: {
      client: {
        mollie: mollieClient,
        qonto: qontoClient,
      },
      mollieCustomerId,
      qontoClientId,
    },
  }
}
