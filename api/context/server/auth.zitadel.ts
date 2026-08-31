import { getZitadelConfig } from 'infra/zitadel/mod.ts'
import { ZitadelAuthClient } from 'infra/zitadel/auth-client.ts'
import { Session, SupabaseClient } from '@supabase/supabase-js'
import { ServerAuthContext } from '../mod.ts'

/**
 * Zitadel implementation of the server auth adapter. Produces the same ServerAuthContext shape
 * as the Supabase adapter. The context types still name Supabase (see api/context/mod.ts);
 * the boundary casts here are the single place that difference is absorbed.
 */
export async function createServerAuthContextZitadel(
  opts: { auth: { accessToken: string | undefined; refreshToken: string | undefined } },
): Promise<ServerAuthContext> {
  if (!opts.auth.accessToken || !opts.auth.refreshToken) {
    throw new Error('Access token and refresh token are required for authentication context')
  }
  const client = new ZitadelAuthClient(inMemoryStorage(), getZitadelConfig())
  try {
    const { data: { session, user }, error } = await client.setSession({
      access_token: opts.auth.accessToken,
      refresh_token: opts.auth.refreshToken,
    })
    if (error || !session || !user) {
      throw new Error(error?.message ?? 'Failed to establish session from provided tokens')
    }
    return {
      auth: {
        client: client as unknown as SupabaseClient['auth'],
        session: session as unknown as Session,
        user: {
          avatar: user.user_metadata.avatar_url ?? '',
          email: user.email ?? '',
          id: user.id,
          name: user.user_metadata.name ?? user.app_metadata.user_name ?? '',
          createdAt: new Date(user.created_at),
        },
      },
    }
  } catch (error) {
    console.error('Error establishing Zitadel session:', error)
    throw new Error('Please log in again to continue.')
  }
}

function inMemoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}
