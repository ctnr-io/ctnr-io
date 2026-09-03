import { getZitadelConfig } from 'infra/zitadel/mod.ts'
import { ZitadelAuthClient } from 'infra/zitadel/auth-client.ts'
import type { ClientAuthContext } from '../mod.ts'

/**
 * Loads any persisted Zitadel session from the provided storage; returns a null session/user
 * when unauthenticated. The Zitadel `sub` is used verbatim as the owner id (numeric snowflake,
 * not a UUID - never run it through shortUUID).
 */
export async function createClientAuthContext(
  { storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<ClientAuthContext> {
  const client = new ZitadelAuthClient(storage, getZitadelConfig())
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
