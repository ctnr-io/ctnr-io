import { ensureUserNamespace, getKubeClient } from 'lib/kube-client.ts'
import { KubeContext } from '../mod.ts'

const contexts = ['eu', 'eu-0', 'eu-1', 'eu-2'] as const

export async function createKubeServerContext(userId: string): Promise<KubeContext> {
  const clients: Record<typeof contexts[number], Awaited<ReturnType<typeof getKubeClient>>> = Object.fromEntries(
    await Promise.all(contexts.map(async (context) => [context, await getKubeClient(context)])),
  )
  return {
    kube: {
      client: clients,
      namespace: await ensureUserNamespace(clients['eu'], userId),
    },
  }
}
