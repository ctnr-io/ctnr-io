import { getSupabaseConfig } from 'infra/supabase/mod.ts'
import { createClient } from '@supabase/supabase-js'
import { ServerAuthContext } from '../mod.ts'
import { getAuthProvider } from '../auth-provider.ts'
import { createServerAuthContextZitadel } from './auth.zitadel.ts'
import * as shortUUID from '@opensrc/short-uuid'

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36)

/** Dispatches to the auth adapter selected by AUTH_PROVIDER (default: supabase). */
export function createServerAuthContext(
  opts: { auth: { accessToken: string | undefined; refreshToken: string | undefined } },
): Promise<ServerAuthContext> {
  return getAuthProvider() === 'zitadel' ? createServerAuthContextZitadel(opts) : createServerAuthContextSupabase(opts)
}

export async function createServerAuthContextSupabase(
  opts: { auth: { accessToken: string | undefined; refreshToken: string | undefined } },
): Promise<ServerAuthContext> {
  const config = getSupabaseConfig()
  const supabase = createClient(config.url, config.anonKey)
  if (!opts.auth.accessToken || !opts.auth.refreshToken) {
    throw new Error('Access token and refresh token are required for authentication context')
  }
  try {
    const { data: { session, user } } = await supabase.auth.setSession({
      access_token: opts.auth.accessToken,
      refresh_token: opts.auth.refreshToken,
    })
    if (!session) {
      throw new Error('Failed to set session with provided tokens')
    }
    if (!user) {
      throw new Error('Failed to retrieve user from session')
    }
    return {
      auth: {
        client: supabase.auth,
        session: session,
        user: {
          avatar: user.user_metadata.avatar_url,
          email: user.email!,
          id: shortUUIDtranslator.fromUUID(user.id),
          name: user.app_metadata.user_name,
          createdAt: new Date(user.created_at),
        },
      },
    }
  } catch (error) {
    console.error('Error setting session:', error)
    throw new Error('Please log in again to continue.')
  }
}
