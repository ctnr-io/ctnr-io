import { ClientAuthContext } from 'ctx/mod.ts'
import { ClientRequest } from 'lib/api/types.ts'

export default async ({ ctx }: ClientRequest<unknown, ClientAuthContext>) => {
  try {
    // Clear Supabase session
    await ctx.auth.client.signOut()
    // Reset auth context
    // ctx = await createClientAuthContext({ storage: ctx.auth.storage })
    console.info('🔓 Logged out successfully')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn('❌ Error during logout:', message)
  }
}
