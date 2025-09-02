import { ensureUserNamespace, getKubeClient } from 'lib/kubernetes/kube-client.ts'
import { KubeServerContext } from '../mod.ts'

const contexts = ['eu', 'eu-0', 'eu-1', 'eu-2'] as const

export async function createKubeServerContext(userId: string, signal: AbortSignal): Promise<KubeServerContext> {
  const clients: Record<typeof contexts[number], Awaited<ReturnType<typeof getKubeClient>>> = Object.fromEntries(
    await Promise.all(contexts.map(async (context) => [context, await getKubeClient(context)])),
  )
  return {
    kube: {
      client: clients,
      namespace: await ensureUserNamespace(clients['eu'], userId, signal),
    },
  }
}
