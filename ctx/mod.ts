import { KubeClient } from 'lib/kube-client.ts'
import { Session, SupabaseClient, User } from '@supabase/supabase-js'

export type SignalContext = {
  signal: AbortSignal | undefined
}

export type Signals =
  | 'SIGINT'
  | 'SIGQUIT'

export type StdioContext = {
  stdio: {
    stdin: ReadableStream
    stdout: WritableStream
    stderr: WritableStream
    exit: (code: number) => void
    setRaw: (value: boolean) => void
    signalChan: () => AsyncGenerator<Signals, void, unknown>
    terminalSizeChan: () => AsyncGenerator<{ columns: number; rows: number }, void, unknown>
  }
}

export type KubeContext = {
  kube: {
    client: KubeClient
    namespace: string
  }
}

export type DeferServerContext = {
  defer: {
    (fn: () => any): number
    run(): Promise<void>
  }
}

/**
 * User should always be authenticated in server context.
 */
export type AuthServerContext = {
  auth: {
    client: SupabaseClient['auth']
    session: Session
    user: User
  }
}

/**
 * User may or may not be authenticated in client context.
 * If unauthenticated, session and user will be null.
 */
export type AuthClientContext = AuthServerContext | {
  auth: {
    client: SupabaseClient['auth']
    session: null
    user: null
  }
}

export type ServerContext = SignalContext & StdioContext & KubeContext & AuthServerContext & DeferServerContext & {
  __type: 'server'
}
export type ClientContext = SignalContext & StdioContext & AuthClientContext & { __type: 'client' }
