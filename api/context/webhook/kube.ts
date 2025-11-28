import { createKubeClient } from 'infra/kubernetes/mod.ts'
import { WebhookKubeContext } from '../mod.ts'

const contexts = ['karmada', 'eu-0', 'eu-1', 'eu-2'] as const

export async function createKubeServerWebhookContext(): Promise<WebhookKubeContext> {
  const clients: Record<typeof contexts[number], Awaited<ReturnType<typeof createKubeClient>>> = Object.fromEntries(
    await Promise.all(contexts.map(async (context) => [context, await createKubeClient(context)])),
  )
  return {
    kube: {
      client: clients,
    },
  }
}
