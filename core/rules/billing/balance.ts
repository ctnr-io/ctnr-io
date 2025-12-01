import { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import { calculateTotalCostWithFreeTierSince } from './cost.ts'
import { KubeClient } from 'infra/kubernetes/mod.ts'
import z from 'zod'
import SuperJSON from 'superjson'

export const Balance = z.object({
  credits: z.number(),
  lastUpdated: z.string().or(z.number()), // timestamp in milliseconds
})

export type Balance = z.infer<typeof Balance>

export function getNextBalance(balance: Balance, usage: { cpu: string; memory: string; storage: string }): Balance {
  const creditsBalance = balance.credits
  const lastUpdateed = balance.lastUpdated

  const cost = calculateTotalCostWithFreeTierSince(
    usage,
    new Date(lastUpdateed).getTime(),
  )

  const newBalance = Math.max(0, creditsBalance - cost)

  return {
    credits: newBalance,
    lastUpdated: new Date().toISOString(),
  }
}

export function getNamespaceBalance(namespace: Namespace): Balance {
  const balanceAnnotation = namespace.metadata?.annotations?.['ctnr.io/balance']
  const balance = Balance.parse(
    balanceAnnotation ? SuperJSON.parse(balanceAnnotation) : { 'credits': 0, 'lastUpdated': new Date().toISOString() },
  )
  return balance
}

export async function updateBalance(
  kubeClient: KubeClient,
  namespace: string,
  balance: Balance,
  signal: AbortSignal,
): Promise<Balance> {
  await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
    metadata: {
      annotations: {
        'ctnr.io/balance': SuperJSON.stringify(balance),
      },
    },
  }, {
    abortSignal: signal,
  })
  return balance
}

export async function addCredits(
  kubeClient: KubeClient,
  namespace: string,
  creditsToAdd: number,
  signal: AbortSignal,
): Promise<Balance> {
  const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace)
  const { credits: currentCredits, lastUpdated } = getNamespaceBalance(namespaceObj)
  const newCredits = currentCredits + creditsToAdd
  return await updateBalance(
    kubeClient,
    namespace,
    {
      credits: newCredits,
      lastUpdated,
    },
    signal,
  )
}
