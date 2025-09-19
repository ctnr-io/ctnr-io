import { getSupabaseClient } from 'lib/auth/supabase.ts'
import type { ClientAuthContext } from '../mod.ts'

export async function createClientAuthContext(
  { storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<ClientAuthContext> {
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
