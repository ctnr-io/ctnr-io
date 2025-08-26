import { KubeClient } from 'lib/kube-client.ts'
import { Session, SupabaseClient } from '@supabase/supabase-js'

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

export type KubeContext = {
  kube: {
    client: Record<KubeCluster, KubeClient>
    namespace: string
  }
}

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

export type ServerContext = StdioContext & KubeContext & AuthServerContext & {
  __type: 'server'
}
export type ClientContext = StdioContext & AuthClientContext & { __type: 'client' }
