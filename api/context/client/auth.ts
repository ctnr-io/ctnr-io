import { getSupabaseClient } from 'infra/supabase/mod.ts'
import type { ClientAuthContext } from '../mod.ts'
import { getAuthProvider } from '../auth-provider.ts'
import { createClientAuthContextZitadel } from './auth.zitadel.ts'
import * as shortUUID from '@opensrc/short-uuid'

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36)

/** Dispatches to the auth adapter selected by AUTH_PROVIDER (default: supabase). */
export function createClientAuthContext(
  opts: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<ClientAuthContext> {
  return getAuthProvider() === 'zitadel' ? createClientAuthContextZitadel(opts) : createClientAuthContextSupabase(opts)
}

export async function createClientAuthContextSupabase(
  { storage }: { storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> },
): Promise<ClientAuthContext> {
  const supabase = getSupabaseClient({
    storage,
  })
  const { data: { session } } = await supabase.auth.getSession().catch((error) => ({ error, data: { session: null } }))
  const { data: { user } } = await supabase.auth.getUser().catch((error) => ({ error, data: { user: null } }))
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
        id: shortUUIDtranslator.fromUUID(user.id),
        email: user.email || '',
        name: user.user_metadata.name || '',
        avatar: user.user_metadata.avatar_url || '',
        createdAt: new Date(user.created_at) || '',
      },
    },
  }
}
