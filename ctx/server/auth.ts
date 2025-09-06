import { getSupabaseConfig } from 'lib/auth/supabase.ts'
import { createClient } from '@supabase/supabase-js'
import { AuthServerContext } from '../mod.ts'

export async function createAuthServerContext(
  opts: { auth: { accessToken: string | undefined; refreshToken: string | undefined } },
): Promise<AuthServerContext> {
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
          id: user.id,
          name: user.user_metadata.name,
          createdAt: new Date(user.created_at),
        },
      },
    }
  } catch (error) {
    console.error('Error setting session:', error)
    throw new Error('Please log in again to continue.')
  }
}
