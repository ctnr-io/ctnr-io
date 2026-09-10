import { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import { calculateTotalCostSince } from './cost.ts'
import { KubeClient } from 'infra/kubernetes/mod.ts'
import z from 'zod'
import SuperJSON from 'superjson'

export const DAILY_FREE_CREDITS = 500

export const Balance = z.object({
  freeCredits: z.number(),
  paidCredits: z.number(),
  freeCreditsResetAt: z.string().or(z.number()), // timestamp in milliseconds
  lastUpdated: z.string().or(z.number()), // timestamp in milliseconds
})

export type Balance = z.infer<typeof Balance>

// Pre-split single-pool shape, kept only to migrate old `ctnr.io/balance` annotations on read.
const LegacyBalance = z.object({
  credits: z.number(),
  lastUpdated: z.string().or(z.number()),
})

export function getTotalCredits(balance: Balance): number {
  return balance.freeCredits + balance.paidCredits
}

/**
 * Grants a fresh DAILY_FREE_CREDITS allotment once freeCreditsResetAt has passed.
 * Pure: returns the same balance reference when no reset is due, so callers can persist
 * only when the result differs.
 */
export function ensureDailyFreeCredits(balance: Balance): Balance {
  const now = Date.now()
  const resetAt = new Date(balance.freeCreditsResetAt).getTime()
  if (!balance.freeCreditsResetAt || Number.isNaN(resetAt) || now >= resetAt) {
    return {
      ...balance,
      freeCredits: DAILY_FREE_CREDITS,
      freeCreditsResetAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    }
  }
  return balance
}

export function getNextBalance(balance: Balance, usage: { cpu: string; memory: string; storage: string }): Balance {
  const cost = calculateTotalCostSince(
    usage,
    new Date(balance.lastUpdated).getTime(),
  )

  // Debit free credits first, paid credits only for what free credits can't cover.
  const freeDebit = Math.min(balance.freeCredits, cost)
  const paidDebit = Math.min(balance.paidCredits, Math.max(0, cost - freeDebit))

  return {
    ...balance,
    freeCredits: balance.freeCredits - freeDebit,
    paidCredits: balance.paidCredits - paidDebit,
    lastUpdated: new Date().toISOString(),
  }
}

export function getNamespaceBalance(namespace: Namespace): Balance {
  const balanceAnnotation = namespace.metadata?.annotations?.['ctnr.io/balance']

  if (!balanceAnnotation) {
    return Balance.parse({
      freeCredits: 0,
      paidCredits: 0,
      freeCreditsResetAt: 0,
      lastUpdated: new Date().toISOString(),
    })
  }

  const parsed = SuperJSON.parse(balanceAnnotation)
  const result = Balance.safeParse(parsed)
  if (result.success) {
    return result.data
  }

  // Migrate the old single-pool annotation shape: fold it into paidCredits and force an
  // immediate free-credits grant (freeCreditsResetAt in the past) on the next read.
  const legacy = LegacyBalance.parse(parsed)
  return Balance.parse({
    freeCredits: 0,
    paidCredits: legacy.credits,
    freeCreditsResetAt: 0,
    lastUpdated: legacy.lastUpdated,
  })
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
  const balance = getNamespaceBalance(namespaceObj)
  return await updateBalance(
    kubeClient,
    namespace,
    {
      ...balance,
      paidCredits: balance.paidCredits + creditsToAdd,
    },
    signal,
  )
}
