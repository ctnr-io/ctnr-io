import { ensureMollieCustormerId, getMollieClient } from 'lib/billing/mollie.ts'
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

  const mollieCustomerId = await ensureMollieCustormerId({
    kubeClient: ctx.kube.client['eu'],
    mollieClient,
    namespaceObj: namespace,
    email: ctx.auth.user.email,
    userId: ctx.auth.user.id,
    signal,
  })

  // The qonto client id can change over time due to invoicing
  // I choose to use the mollie customer id as the only source of trust
  const labels = namespace.metadata?.labels
  const qontoClientId = labels?.['ctnr.io/qonto-client-id'] || undefined

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
