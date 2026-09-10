// Ambient bridge for the app's tRPC client and auth handlers, mirroring their real Deno-side shapes.
declare module 'api/drivers/trpc/client/expo/mod.tsx' {
  import type { QueryKey, UseMutationOptions, UseQueryOptions, UseInfiniteQueryOptions, InfiniteData } from '@tanstack/react-query'
  import type { ReactNode } from 'react'
  import type { Container } from 'core/schemas/mod.ts'
  import type { BillingClient } from 'core/rules/billing/utils.ts'

  // Mirrors lib/api/schemas.ts's Project; not imported directly since that file's own bare
  // specifiers (zod) don't resolve from its real location under this tsconfig's paths.
  interface Project {
    id: string
    name: string
    ownerId: string
    cluster: string
  }

  interface Balance {
    freeCredits: number
    paidCredits: number
    freeCreditsResetAt: string | number
    lastUpdated: string | number
  }

  interface UsageResourceStat {
    used: string
    limit: string
    percentage: number
  }

  interface Usage {
    balance: Balance
    resources: {
      cpu: UsageResourceStat
      memory: UsageResourceStat
      storage: UsageResourceStat
    }
    costs: {
      current: { hourly: number; daily: number; monthly: number }
      next: { hourly: number; daily: number; monthly: number }
      max: { hourly: number; daily: number; monthly: number }
    }
    status: string
    tier: 'free' | 'paid'
  }

  // Mirrors core/schemas/billing/invoice.ts's Invoice.
  interface Invoice {
    id: string
    createdAt: string
    description: string
    credits: number
    amount: { value: string; currency: string }
    status: 'paid' | 'pending' | 'failed'
    downloadUrl?: string
  }

  interface QueryProcedure<TInput, TOutput> {
    queryOptions(input: TInput, opts?: Record<string, unknown>): UseQueryOptions<TOutput, Error, TOutput, QueryKey>
    queryKey(input?: TInput): QueryKey
  }

  interface InfiniteQueryProcedure<TInput, TOutput, TCursor> {
    infiniteQueryOptions(
      input: TInput,
      opts: { getNextPageParam: (lastPage: TOutput) => TCursor | undefined },
    ): UseInfiniteQueryOptions<TOutput, Error, InfiniteData<TOutput>, QueryKey, TCursor>
    queryKey(input?: TInput): QueryKey
  }

  interface MutationProcedure<TInput, TOutput> {
    mutationOptions(opts?: Record<string, unknown>): UseMutationOptions<TOutput, Error, TInput>
  }

  interface SubscriptionProcedure<TInput, TYield> {
    subscriptionOptions(
      input: TInput,
      opts?: {
        onData?: (data: { type: 'yield'; value: TYield } | { type: 'return'; value?: void }) => void
        onError?: (err: unknown) => void
      },
    ): unknown
  }

  export interface TRPCServerRouter {
    billing: {
      getUsage: QueryProcedure<Record<string, never>, Usage>
      getInvoices: InfiniteQueryProcedure<{ cursor: string | undefined; limit: number }, Invoice[], string>
      purchaseCredits: MutationProcedure<
        { amount: number; type: 'one-time'; client: BillingClient },
        { paymentUrl: string }
      >
      getClient: QueryProcedure<Record<string, never>, BillingClient | null>
      setLimits: MutationProcedure<{ cpu: string; memory: string; storage: string }, void>
    }
    core: {
      listQuery: QueryProcedure<{ output: 'raw'; name?: string; fields?: string[] }, Container[]>
      logs: SubscriptionProcedure<
        { name: string; follow?: boolean; replica?: string[]; timestamps?: boolean; tail?: number },
        string
      >
      startMutation: MutationProcedure<{ name: string }, void>
      stopMutation: MutationProcedure<{ name: string }, void>
      restartMutation: MutationProcedure<{ name: string }, void>
      removeMutation: MutationProcedure<{ name: string; force: boolean }, void>
      runMutation: MutationProcedure<
        {
          image: string
          name?: string
          env?: string[]
          publish?: string[]
          volume?: string[]
          domain?: string
          interactive?: boolean
          terminal?: boolean
          detach?: boolean
          route?: string
          force?: boolean
          command?: string
          replicas?: number | string
          cpu?: string
          memory?: string
          restart?: 'always' | 'on-failure' | 'never'
        },
        void
      >
    }
    network: {
      domains: {
        listQuery: QueryProcedure<{ output: 'raw' }, unknown[]>
        createMutation: MutationProcedure<{ domain: string }, void>
        deleteMutation: MutationProcedure<{ name: string }, void>
      }
      routes: {
        listQuery: QueryProcedure<{ output: 'raw' }, unknown[]>
        createMutation: MutationProcedure<
          { name: string; container: string; domain?: string; port: number; path: string; protocol: 'http' | 'https' },
          void
        >
        deleteMutation: MutationProcedure<{ name: string }, void>
      }
    }
    tenancy: {
      project: {
        getQuery: QueryProcedure<Record<string, never>, Project>
      }
    }
    storage: {
      volumes: {
        listQuery: QueryProcedure<{ output: 'raw' }, unknown[]>
        createMutation: MutationProcedure<{ name: string; size: string }, void>
        deleteMutation: MutationProcedure<{ name: string; force: boolean }, void>
      }
    }
  }

  interface ExpoTrpcAuthClient {
    signOut(): Promise<void>
    exchangeCodeForSession(code: string): Promise<{ error: { message: string } | null }>
  }

  interface ExpoTrpcClientContext {
    auth: {
      session: unknown
      user?: { id: string; name: string; email: string; avatar: string } | null
      client: ExpoTrpcAuthClient
    }
  }

  export function useTRPC(): TRPCServerRouter
  export function useExpoTrpcClientContext(): ExpoTrpcClientContext
  export function ExpoTrpcClientProvider(props: {
    children: ReactNode
    fallback: (props: { error: Error | null }) => ReactNode
  }): ReactNode
}

declare module 'api/handlers/client/auth/login_from_app.ts' {
  // Mirrors lib/api/types.ts's ClientRequest/ClientResponse<void>; not imported directly since
  // that file's own bare specifiers don't resolve from its real location under this tsconfig.
  // Context is opaque here: the app only ever forwards its own useExpoTrpcClientContext() value.
  export default function loginFromApp(request: { ctx: unknown; input: unknown }): AsyncGenerator<string, void, unknown>
  export function handleAuthCallback(url: string): void
}

declare module 'api/handlers/client/auth/logout.ts' {
  export default function logout(request: { ctx: unknown; input: unknown }): Promise<void>
}
