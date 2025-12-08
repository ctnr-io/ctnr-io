import { createKubeClient } from 'infra/kubernetes/mod.ts'
import { ServerKubeContext } from '../mod.ts'

const contexts = ['karmada', 'eu-1'] as const

export async function createServerKubeContext(userId: string, signal: AbortSignal): Promise<ServerKubeContext> {
  const clients: Record<typeof contexts[number], Awaited<ReturnType<typeof createKubeClient>>> = Object.fromEntries(
    await Promise.all(contexts.map(async (context) => [context, await createKubeClient(context)])),
  )
  return {
    kube: {
      client: clients,
    },
  }
}
