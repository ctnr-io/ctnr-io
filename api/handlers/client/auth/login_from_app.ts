import { ClientAuthContext } from 'api/context/mod.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import { Platform } from 'react-native'
import login from './login.ts'

export default async function* loginFromApp({ ctx }: ClientRequest<unknown, ClientAuthContext>): ClientResponse {
  try {
    if (Platform.OS === 'web') {
      yield* loginWeb(ctx)
      return
    }
    yield* loginNative(ctx)
  } catch (error) {
    throw new Error(`OAuth flow failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Web: the OAuth flow is a full-page browser redirect. Capture the authorize URL from the shared
 * login generator, then navigate the whole page to it. The PKCE verifier is persisted in the
 * client storage (localStorage) so `auth/callback` can complete `exchangeCodeForSession`.
 */
async function* loginWeb(ctx: ClientAuthContext): ClientResponse {
  const redirectTo = `${globalThis.location.origin}/auth/callback`
  for await (const message of login({ ctx, input: { redirectTo, provider: 'github' } })) {
    if (typeof message === 'string' && message.startsWith('Open this URL: ')) {
      const oauthUrl = message.replace('Open this URL: ', '')
      yield '📱 Redirecting to sign-in...'
      globalThis.location.href = oauthUrl
      return
    }
  }
}

/**
 * Native: use the `ctnr-io://auth/callback` deep link. The app's auth/callback route extracts the
 * code and forwards it to the global handler, which resolves the wait below.
 */
async function* loginNative(ctx: ClientAuthContext): ClientResponse {
  const deepLinkRedirectUri = 'ctnr-io://auth/callback'
  const { promise: callbackPromise, resolve: resolveCallback } = Promise.withResolvers<{ code: string }>()

  const handleDeepLink = (url: string) => {
    try {
      const parsedUrl = new URL(url)
      const code = parsedUrl.searchParams.get('code')
      const error = parsedUrl.searchParams.get('error')
      if (error) {
        throw new Error(`OAuth error: ${error}`)
      }
      if (code) {
        resolveCallback({ code })
      }
    } catch (err) {
      console.error('Error parsing deep-link:', err)
    }
  }
  ;(globalThis as any).__ctnrAuthCallback = handleDeepLink

  try {
    for await (const message of login({ ctx, input: { redirectTo: deepLinkRedirectUri, provider: 'github' } })) {
      if (typeof message === 'string' && message.startsWith('Open this URL: ')) {
        const oauthUrl = message.replace('Open this URL: ', '')
        yield '📱 Opening browser for authentication...'
        yield `Please open this URL in your browser: ${oauthUrl}`
        yield '⏳ Waiting for authentication callback...'
        await callbackPromise
        continue
      }
      yield message
    }
  } finally {
    delete (globalThis as any).__ctnrAuthCallback
  }
}

/**
 * Called by the app's native deep-link handler (auth/callback route) to forward the OAuth code
 * back to the waiting native login flow.
 */
export function handleAuthCallback(url: string): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__ctnrAuthCallback) {
    ;(globalThis as any).__ctnrAuthCallback(url)
  }
}
