import { ClientAuthContext } from 'api/context/mod.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import z from 'zod'

export const Input = z.object({
  token: z.string().describe('Supabase access token for direct authentication, bypassing OAuth'),
  refreshToken: z.string().optional().default('').describe('Supabase refresh token (optional)'),
})

export type Input = z.infer<typeof Input>

export default async function* loginWithToken(
  { ctx, input }: ClientRequest<Input, ClientAuthContext>,
): ClientResponse {
  const { data, error } = await ctx.auth.client.setSession({
    access_token: input.token,
    refresh_token: input.refreshToken ?? '',
  })

  if (error) {
    throw new Error(`Token authentication failed: ${error.message}`)
  }

  if (!data.session) {
    throw new Error('Failed to establish session from token')
  }

  yield `✅ Authenticated as ${data.session.user?.email ?? 'unknown user'}`
}
