import { getZitadelConfig } from 'infra/zitadel/mod.ts'
import { ZitadelAuthClient } from 'infra/zitadel/auth-client.ts'
import { Session, SupabaseClient } from '@supabase/supabase-js'
import type { ClientAuthContext } from '../mod.ts'

/**
 * Zitadel implementation of the client auth adapter. Mirrors the Supabase client adapter:
 * loads any persisted session from the provided storage; returns a null session/user when
 * unauthenticated. Boundary casts absorb the Supabase-named context types.
 */
export async function createClientAuthContextZitadel(
  { storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<ClientAuthContext> {
  const client = new ZitadelAuthClient(storage, getZitadelConfig())
  const { data: { session } } = await client.getSession()
  if (!session || !session.user) {
    return {
      auth: {
        storage,
        client: client as unknown as SupabaseClient['auth'],
        session: null,
        user: null,
      },
    }
  }
  return {
    auth: {
      storage,
      client: client as unknown as SupabaseClient['auth'],
      session: session as unknown as Session,
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
