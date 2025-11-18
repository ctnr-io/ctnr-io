import { getKubeClient } from 'lib/kubernetes/kube-client.ts'
import { ServerKubeContext } from '../mod.ts'

const contexts = ['karmada', 'eu-0', 'eu-1', 'eu-2'] as const

export async function createServerKubeContext(userId: string, signal: AbortSignal): Promise<ServerKubeContext> {
  const clients: Record<typeof contexts[number], Awaited<ReturnType<typeof getKubeClient>>> = Object.fromEntries(
    await Promise.all(contexts.map(async (context) => [context, await getKubeClient(context)])),
  )
  return {
    kube: {
      client: clients,
    },
  }
}
