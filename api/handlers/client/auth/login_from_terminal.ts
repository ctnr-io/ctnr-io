import { ClientAuthContext, LoggerContext } from 'api/context/mod.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import login from './login.ts'
import { html } from '@tmpl/core'

function extractOAuthUrl(message: string): string | null {
  const match = message.match(/Open this URL:\s*(\S+)/)
  return match?.[1] ?? null
}

export default async function* loginFromTerminal(
  { ctx }: ClientRequest<unknown, ClientAuthContext & LoggerContext>,
): ClientResponse {
  // Start callback server to get redirect URI
  const { server, promise, url: redirectUri } = startCallbackServer()

  try {
    // Use the shared login function with the callback server's redirect URI
    const loginGenerator = login({
      ctx,
      input: {
        redirectTo: redirectUri,
        provider: 'github',
      },
    })

    // Process login generator and capture OAuth URL
    for await (const message of loginGenerator) {
      const messageText = typeof message === 'string' ? message : message.value
      const extractedOAuthUrl = messageText ? extractOAuthUrl(messageText) : null

      // Check if this message contains the OAuth URL
      if (extractedOAuthUrl) {
        const oauthUrl = extractedOAuthUrl

        // Open browser instead of just yielding the message
        yield ctx.log.loader('📱 Opening browser for authentication...')

        // Check if running in terminal and try to open browser
        if (typeof Deno !== 'undefined' && Deno.stdin?.isTerminal?.()) {
          try {
            await openBrowser(oauthUrl)
          } catch {
            yield 'Failed to open browser automatically.'
            yield `Please open the following URL in your browser: ${oauthUrl}`
            yield `  ${oauthUrl}`
            yield 'After authenticating, return to this terminal to continue.'
          }
        } else {
          yield 'Please open the following URL in your browser:'
          yield `  ${oauthUrl}`
          yield 'After authenticating, return to this terminal to continue.'
        }

        // Wait for the callback
        yield ctx.log.loader('🤙 Waiting for authentication callback...')
        const { code } = await promise

        // Exchange the authorization code for a session
        yield ctx.log.loader('🔄 Completing authentication...')
        const { data, error } = await ctx.auth.client.exchangeCodeForSession(code)

        if (error) {
          throw new Error(`Failed to exchange code for session: ${error.message}`)
        }

        if (data.session) {
          yield '🔑 Authentication successful!'
          return
        } else {
          throw new Error('Session not established after code exchange')
        }
      }

      // Pass through other messages from login
      yield message
    }
  } finally {
    server.shutdown()
  }
}

/**
 * Start local HTTP server to handle OAuth callback
 */
export function startCallbackServer(): {
  url: string
  server: Deno.HttpServer
  promise: Promise<{ code: string }>
} {
  // Find available port starting from 8080
  const { resolve, reject, promise } = Promise.withResolvers<{ code: string }>()

  const timeout = setTimeout(() => {
    reject(new Error('OAuth callback timeout (5 minutes)'))
  }, 5 * 60 * 1000) // 5 minute timeout

  // Add a random path hash to prevent other processes from trying to exploit the callback URL

  const server = Deno.serve({ port: 0, hostname: '127.0.0.1' }, (request) => {
    const url = new URL(request.url)

    if (url.pathname === `/callback`) {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        clearTimeout(timeout)
        reject(new Error(`OAuth error: ${error}`))
        return new Response(
          html`
            <html>
              <body>
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `,
          { headers: { 'content-type': 'text/html' } },
        )
      }

      if (code) {
        clearTimeout(timeout)
        resolve({ code })
        return new Response(
          html`
            <html>
              <body>
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to your terminal.</p>
                <script>
                window.close();
                </script>
              </body>
            </html>
          `,
          { headers: { 'content-type': 'text/html' } },
        )
      }
    }

    return new Response(
      html`
        <html>
          <body>
            <h1>ctnr CLI Authentication</h1>
            <p>Waiting for authentication...</p>
          </body>
        </html>
      `,
      { headers: { 'content-type': 'text/html' } },
    )
  })

  let port: number
  if (server.addr.transport === 'tcp') {
    port = server.addr.port
  } else {
    throw new Error('Unexpected server transport: ' + server.addr.transport)
  }

  const url = `http://localhost:${port}/callback`
  console.debug(`OAuth callback URL: ${url}`)

  return { url, server, promise }
}

/**
 * Open URL in default browser
 */
export async function openBrowser(url: string): Promise<void> {
  const commands = {
    darwin: ['open'],
    linux: ['xdg-open'],
    windows: ['cmd', '/c', 'start'],
  }

  const command = commands[Deno.build.os as keyof typeof commands]
  if (!command) {
    throw new Error(`Unsupported platform: ${Deno.build.os}`)
  }

  try {
    const process = new Deno.Command(command[0], {
      args: command.length > 1 ? [...command.slice(1), url] : [url],
      stdout: 'null',
      stderr: 'null',
    })

    await process.output()
  } catch (error) {
    throw new Error(`Failed to open browser: ${error instanceof Error ? error.message : String(error)}`)
  }
}
