import { getZitadelConfig } from 'infra/zitadel/mod.ts'
import { ZitadelAuthClient } from 'infra/zitadel/auth-client.ts'
import type { AuthClient } from 'infra/zitadel/auth-client.ts'
import type { ClientAuthContext } from '../mod.ts'

/**
 * Zitadel env vars are only required for commands that actually need auth (login, deploy, ...).
 * When they're missing, return a client that reports the original config error on first use
 * instead of throwing at CLI bootstrap - so auth-independent commands (e.g. `ctnr compose`)
 * still work.
 */
function createUnconfiguredAuthClient(error: Error): AuthClient {
  const authError = { message: error.message }
  return {
    getSession: () => Promise.resolve({ data: { session: null }, error: authError }),
    getUser: () => Promise.resolve({ data: { user: null }, error: authError }),
    setSession: () => Promise.resolve({ data: { session: null, user: null }, error: authError }),
    signInWithOAuth: () => Promise.resolve({ data: { url: null, provider: '' }, error: authError }),
    exchangeCodeForSession: () => Promise.resolve({ data: { session: null }, error: authError }),
    signOut: () => Promise.resolve({ data: {}, error: authError }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  }
}

/**
 * Loads any persisted Zitadel session from the provided storage; returns a null session/user
 * when unauthenticated. The Zitadel `sub` is used verbatim as the owner id (numeric snowflake,
 * not a UUID - never run it through shortUUID).
 */
export async function createClientAuthContext(
  { storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<ClientAuthContext> {
  let client: AuthClient
  try {
    client = new ZitadelAuthClient(storage, getZitadelConfig())
  } catch (error) {
    return {
      auth: {
        storage,
        client: createUnconfiguredAuthClient(error instanceof Error ? error : new Error(String(error))),
        session: null,
        user: null,
      },
    }
  }
  const { data: { session } } = await client.getSession()
  if (!session || !session.user) {
    return {
      auth: {
        storage,
        client,
        session: null,
        user: null,
      },
    }
  }
  return {
    auth: {
      storage,
      client,
      session,
      user: {
        id: session.user.id,
        email: session.user.email ?? '',
        name: session.user.user_metadata.name ?? '',
        avatar: session.user.user_metadata.avatar_url ?? '',
        createdAt: new Date(session.user.created_at),
      },
    },
  }
}
