import { ClientAuthContext } from 'api/context/mod.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import login from './login.ts'

export default async function* loginFromApp({ ctx }: ClientRequest<unknown, ClientAuthContext>): ClientResponse {
  try {
    // Use deep-linking for app-based OAuth flow
    const deepLinkRedirectUri = 'ctnr-io://auth/callback'

    // Set up promise to wait for deep-link callback
    const { promise: callbackPromise, resolve: resolveCallback } = Promise.withResolvers<{ code: string }>()

    // Set up deep-link listener (this would be handled by the app's navigation system)
    // The app's auth/callback route will extract the code and resolve this promise
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

    // Store the callback handler globally so the app can access it
    // In a real implementation, this would be handled by the app's deep-link system
    if (typeof globalThis !== 'undefined') {
      ;(globalThis as any).__ctnrAuthCallback = handleDeepLink
    }

    try {
      // Use the shared login function with the deep-link redirect URI
      const loginGenerator = login({
        ctx,
        input: {
          redirectTo: deepLinkRedirectUri,
          provider: 'github',
        },
      })

      let oauthUrl: string | null = null

      // Process login generator and capture OAuth URL
      for await (const message of loginGenerator) {
        if (typeof message === 'string') {
          // Check if this message contains the OAuth URL
          if (message.startsWith('Open this URL: ')) {
            oauthUrl = message.replace('Open this URL: ', '')

            // Open OAuth URL in system browser
            yield '📱 Opening browser for authentication...'

            try {
              // In a real app environment, this would use expo-web-browser or Linking API
              // For now, we'll provide instructions to the user
              yield `Please open this URL in your browser: ${oauthUrl}`
              yield 'After authenticating, you will be redirected back to the app.'

              // Wait for the deep-link callback
              yield '⏳ Waiting for authentication callback...'
              await callbackPromise

              // Continue with the login flow - it should detect the session
              continue
            } catch (error) {
              console.error('Failed to open browser:', error)
              yield `Please manually open: ${oauthUrl}`
            }
          } else {
            // Pass through other messages from login
            yield message
          }
        }
      }
    } finally {
      // Clean up the global callback handler
      if (typeof globalThis !== 'undefined') {
        delete (globalThis as any).__ctnrAuthCallback
      }
    }
  } catch (error) {
    throw new Error(`OAuth flow failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Helper function to be called by the app's deep-link handler
 * This should be called from the app's auth/callback route
 */
export function handleAuthCallback(url: string): void {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__ctnrAuthCallback) {
    ;(globalThis as any).__ctnrAuthCallback(url)
  }
}
