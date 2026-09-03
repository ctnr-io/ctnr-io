import { getZitadelConfig } from 'infra/zitadel/mod.ts'
import { ZitadelAuthClient } from 'infra/zitadel/auth-client.ts'
import type { ServerAuthContext } from '../mod.ts'

/**
 * Establishes a server-side auth context from the access/refresh tokens carried by the request.
 * The Zitadel `sub` is used verbatim as the owner id (numeric snowflake, not a UUID).
 */
export async function createServerAuthContext(
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
        client,
        session,
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
