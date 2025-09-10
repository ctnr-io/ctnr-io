import { MollieClient } from '@mollie/api-client'
import { KubeClient } from 'lib/kubernetes/kube-client.ts'
import { Session, SupabaseClient } from '@supabase/supabase-js'
import { QontoClient } from 'lib/billing/qonto/mod.ts'

export type Signals =
  | 'SIGINT'
  | 'SIGQUIT'

export type StdioContext = {
  stdio?: {
    stdin: ReadableStream
    stdout: WritableStream
    stderr: WritableStream
    exit: (code: number) => void
    setRaw: (value: boolean) => void
    signalChan: () => AsyncGenerator<Signals, void, unknown>
    terminalSizeChan: () => AsyncGenerator<{ columns: number; rows: number }, void, unknown>
  }
}

type KubeCluster = 'eu' | 'eu-0' | 'eu-1' | 'eu-2'

export type KubeServerContext = {
  kube: {
    client: Record<KubeCluster, KubeClient>
    namespace: string
  }
}

export type KubeWebhookContext = {
  kube: {
    client: Record<KubeCluster, KubeClient>
  }
}

export type KubeWorkerContext = KubeWebhookContext

/**
 * User should always be authenticated in server context.
 */
export type AuthServerContext = {
  auth: {
    client: SupabaseClient['auth']
    session: Session
    user: {
      id: string
      email: string
      name: string
      avatar: string
      createdAt: Date
    }
  }
}

/**
 * User may or may not be authenticated in client context.
 * If unauthenticated, session and user will be null.
 */
export type AuthClientContext =
  & (AuthServerContext | {
    auth: {
      client: SupabaseClient['auth']
      session: null
      user: null
    }
  })
  & ({
    auth: {
      storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
    }
  })

/**
 * TODO: Project context for managing user projects.
 */
export type ProjectContext = {
  project: {
    id: string
    namespace: string
    ownerId: string
  }
}

/**
 * Billing context for managing user billing information.
 */
export type BillingServerContext = {
  billing: {
    client: {
      mollie: MollieClient
      qonto: QontoClient
    }
    mollieCustomerId: string
    qontoClientId: string | undefined
  }
}

export type BillingWebhookContext = {
  billing: {
    client: {
      mollie: MollieClient
      qonto: QontoClient
    }
  }
}

export type BillingWorkerContext = BillingWebhookContext

export type ServerContext = StdioContext & KubeServerContext & AuthServerContext & ProjectContext & BillingServerContext & {
  __type: 'server'
}
export type WebhookContext = KubeWebhookContext & BillingWebhookContext & {
  __type: 'webhook'
}
export type WorkerContext = KubeWorkerContext & BillingWorkerContext & {
  __type: 'worker'
}
export type ClientContext = StdioContext & AuthClientContext & { __type: 'client' }
