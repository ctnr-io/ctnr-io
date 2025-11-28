import { ensureMollieCustormerId, getMollieClient } from 'infra/mollie/mod.ts'
import { ServerAuthContext, ServerBillingContext, ServerKubeContext, ServerProjectContext } from '../mod.ts'
import { getQontoClient } from 'infra/qonto/mod.ts'

export async function createBillingContext(
  ctx: ServerKubeContext & ServerAuthContext & ServerProjectContext,
  signal: AbortSignal,
): Promise<ServerBillingContext> {
  // Retrieve billing mollieCustomerId from namespace label or create customer
  const mollieClient = getMollieClient()
  const qontoClient = getQontoClient()

  const namespace = await ctx.kube.client['karmada'].CoreV1.getNamespace(`ctnr-user-${ctx.project.ownerId}`, {
    abortSignal: signal,
  })

  const mollieCustomerId = await ensureMollieCustormerId({
    kubeClient: ctx.kube.client['karmada'],
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
