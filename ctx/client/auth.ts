import { getSupabaseClient } from 'lib/supabase.ts'
import type { AuthClientContext } from '../mod.ts'

export async function createAuthClientContext({ storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }): Promise<AuthClientContext> {
  const supabase = getSupabaseClient({
    storage,
  })
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!session || !user) {
    return {
      auth: {
        client: supabase.auth,
        session: null,
        user: null,
      },
    }
  }
  return {
    auth: {
      client: supabase.auth,
      session,
      user,
    },
  }
}
