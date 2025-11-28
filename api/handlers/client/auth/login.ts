import { ClientAuthContext } from 'api/context/mod.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import { z } from 'zod'

export const Input = z.object({
  redirectTo: z.string().url().describe('The URL to redirect to after authentication'),
  provider: z.enum(['github']).describe('The OAuth provider to use for authentication'),
})
export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ClientRequest<Input, ClientAuthContext>,
): ClientResponse {
  try {
    const { redirectTo, provider } = input

    // Check if user is already authenticated
    const { data: { session } } = await ctx.auth.client.getSession()
    if (session?.access_token && (session?.expires_at ?? 0) > Date.now()) {
      yield `🔑 Authenticated as ${session.user?.email || 'user'}.`
      return
    }

    yield '🔑 Starting OAuth flow...'

    // Start OAuth flow with GitHub using Supabase
    const { data, error } = await ctx.auth.client.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes: 'user:email',
      },
    })

    if (error) {
      throw new Error(`OAuth initialization failed: ${error.message}`)
    }

    if (!data.url) {
      throw new Error('OAuth URL is missing from response')
    }

    yield '📱 Please complete authentication in your browser...'
    yield `Open this URL: ${data.url}`

    // Wait for the session to be established
    let attempts = 0
    const maxAttempts = 60 // Wait up to 60 seconds

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const { data: { session: newSession } } = await ctx.auth.client.getSession()
      if (newSession?.access_token) {
        yield '✅ Authentication successful!'
        return
      }

      attempts++
    }

    throw new Error('Authentication timeout. Please try again.')
  } catch (error) {
    throw new Error(`OAuth flow failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
