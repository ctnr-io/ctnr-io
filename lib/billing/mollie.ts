import { createMollieClient } from '@mollie/api-client'
import { KubeClient } from '../kubernetes/kube-client.ts'
import { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'

const env = {
  MOLLIE_MODE: Deno.env.get("MOLLIE_MODE"),
  MOLLIE_API_KEY: Deno.env.get('MOLLIE_API_KEY'),
  MOLLIE_API_URL: Deno.env.get("MOLLIE_API_URL"),
  MOLLIE_PROFILE_ID: Deno.env.get("MOLLIE_PROFILE_ID"),
}

for (const [key, value] of Object.entries(env)) {
  if (!value) {
    throw new Error(`${key} is not defined`)
  }
}

export type MollieClient = ReturnType<typeof createMollieClient>

export function getMollieClient(): ReturnType<typeof createMollieClient> {
  return createMollieClient({
    apiKey: env.MOLLIE_API_KEY!,
    apiEndpoint: env.MOLLIE_API_URL!,
  })
}

export async function ensureMollieCustormerId(opts: {
  kubeClient: KubeClient
  mollieClient: MollieClient,
  namespaceObj: Namespace,
  email: string, 
  userId: string
  signal: AbortSignal
}): Promise<string> {
  const { kubeClient, mollieClient, namespaceObj, email, userId, signal } = opts

  const mollieCustomerIdLabel = `ctnr.io/mollie-${Deno.env.get("MOLLIE_MODE")}-customer-id`

  let mollieCustomerId = namespaceObj.metadata?.labels?.[mollieCustomerIdLabel]
  if (!mollieCustomerId) {
    // Create a new customer in Mollie
    const { id } = await mollieClient.customers.create({
      email: email,
      metadata: {
        userId: userId,
      },
    })
    mollieCustomerId = id
    await kubeClient.CoreV1.patchNamespace(namespaceObj.metadata?.name!, 'json-merge', {
      metadata: {
        labels: {
          [mollieCustomerIdLabel]: mollieCustomerId,
        },
      },
    }, {
      abortSignal: signal,
    })
  }
  return mollieCustomerId
}