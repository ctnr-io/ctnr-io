import process from 'node:process'

export type AuthProvider = 'supabase' | 'zitadel'

/**
 * Selects the auth adapter at runtime. Defaults to Supabase so the switch is opt-in and safe.
 * Set AUTH_PROVIDER=zitadel to route auth through the Zitadel OIDC adapter.
 */
export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === 'zitadel' ? 'zitadel' : 'supabase'
}
