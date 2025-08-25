import { getSupabaseClient } from 'lib/supabase.ts'
import type { AuthClientContext } from '../mod.ts'

export async function createAuthClientContext(
  { storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<AuthClientContext> {
  const supabase = getSupabaseClient({
    storage,
  })
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!session || !user) {
    return {
      auth: {
        storage,
        client: supabase.auth,
        session: null,
        user: null,
      },
    }
  }
  return {
    auth: {
      storage,
      client: supabase.auth,
      session,
      user: {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata.name || '',
        avatar: user.user_metadata.avatar_url || '',
        createdAt: new Date(user.created_at) || '',
      },
    },
  }
}
