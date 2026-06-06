import { createKubeClient } from 'infra/kubernetes/mod.ts'
import { ServerKubeContext, KubeClusters } from '../mod.ts'

export async function createServerKubeContext(userId: string, abortSignal: AbortSignal): Promise<ServerKubeContext> {
  const clients: Record<typeof KubeClusters[number], Awaited<ReturnType<typeof createKubeClient>>> = Object.fromEntries(
    await Promise.all(KubeClusters.map(async (context) => [context, await createKubeClient(context)])),
  )
  return {
    kube: {
      client: clients,
    },
  }
}
