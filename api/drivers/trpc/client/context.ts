import { TRPCClient } from '@trpc/client'
import { createClientContext } from 'api/context/client/mod.ts'
import { bypassWebSocketMessageHandler } from 'lib/api/websocket.ts'
import { ClientContext } from 'api/context/mod.ts'
import type { TRPCServerRouter } from 'api/drivers/trpc/server/router.ts'
import { createTRPCWebSocketClient } from './mod.ts'
import process from 'node:process'
import * as GetServerVersion from 'api/handlers/server/protocol/version/get_version.ts'
import { ClientAuthError, ClientVersionError } from 'api/drivers/errors.ts'


export type TrpcClientContext = ClientContext & {
  /**
   * This function prevent to start websocket connection until the first call to `connect`
   * This is useful to avoid unnecessary WebSocket connections when running commands that do not require it like --help.
   */
  connect: <R>(callback: (server: TRPCClient<TRPCServerRouter>) => Promise<R>, opts?: {
    // Default to true, set to false to skip authentication check
    authenticated?: false
  }) => Promise<R>

  /** Disconnect the client and close all connections */
  disconnect?: () => Promise<void>
}

export async function createTrpcClientContext(
  opts: {
    stdio?: ClientContext['stdio']
    auth: {
      storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
    }
  },
): Promise<TrpcClientContext> {
  const ctx = await createClientContext(opts)
  let client: Awaited<ReturnType<typeof createTRPCWebSocketClient>> | null = null

  async function disconnect() {
      if (client) {
        console.log('Disconnecting client connection')
        client.websocket.connection?.ws.close()
        await client.websocket.close()
        client = null
      }
  }

  return {
    ...ctx,
    disconnect,
    connect: async (callback, connectOpts) => {
      try {
        // Disconnect previous client if any
        if (client) {
          await disconnect()
        }

        // Check version compatibility before connecting
        // Call server to know its current version
        {
          const url = new URL(GetServerVersion.Meta.openapi.path, process.env.CTNR_API_URL!)
          const response = await fetch(url, {
            method: GetServerVersion.Meta.openapi.method,
          })
          if (!response.ok) {
            throw new Error('Failed to fetch server version')
          }
          const serverVersion: GetServerVersion.Output = await response.json()
          const clientVersion = process.env.CTNR_VERSION || 'unknown'

          // If cli version != remote version, re-install cli
          if (serverVersion !== clientVersion) {
            throw new ClientVersionError()
          }
        }

        // Check authentication if required
        const { data: { session } } = await ctx.auth.client.getSession()
        if (!session && connectOpts?.authenticated !== false) {
          throw new ClientAuthError('No active session found')
        }

        console.warn('Connect to server at', process.env.CTNR_API_URL)
        const accessToken = session?.access_token
        const refreshToken = session?.refresh_token
        client = await createTRPCWebSocketClient({
          url: process.env.CTNR_API_URL!,
          accessToken: accessToken,
          refreshToken: refreshToken,
        })

        if (opts.stdio) {
          const decoder = new TextDecoder('utf-8')
          opts.stdio.stdin.pipeTo(
            new WritableStream({
              write(chunk) {
                // Forward stdin data to the WebSocket as a JSON object
                client?.websocket.connection?.ws.send(JSON.stringify({
                  type: 'stdin',
                  data: decoder.decode(new Uint8Array(chunk)),
                }))
              },
              close() {
                // Send a message to the WebSocket to indicate that stdin has reached EOF (Ctrl+D)
                // Instead of closing the connection, we send a special message
                client?.websocket.connection?.ws.send(JSON.stringify({
                  type: 'stdin-eof',
                }))
              },
            }),
          )

          bypassWebSocketMessageHandler(
            client.websocket.connection!.ws,
            (event) => {
              try {
                if (!opts.stdio) return false
                const parsed = JSON.parse(event.data)
                if (parsed.type === 'stdout') {
                  const stdoutWriter = opts.stdio.stdout.getWriter()
                  stdoutWriter.write(new TextEncoder().encode(parsed.data))
                  stdoutWriter.releaseLock()
                  return true
                }
                if (parsed.type === 'stderr') {
                  const stderrWriter = opts.stdio.stderr.getWriter()
                  stderrWriter.write(new TextEncoder().encode(parsed.data))
                  stderrWriter.releaseLock()
                  return true
                }
                if (parsed.type === 'set-raw') {
                  opts.stdio.setRaw(parsed.value)
                  return true
                }
                if (parsed.type === 'exit-code') {
                  // Handle exit code message from server
                  // Exit the process with the received exit code
                  opts.stdio.exit(parsed.code)
                  return true
                }
              } catch (_e) {
                // Ignore JSON parsing errors
              }
              return false
            },
          )

          while (!client.websocket.connection?.state || client.websocket.connection?.state !== 'open') {
            // Wait for the WebSocket connection to be established
            await new Promise((resolve) => setTimeout(resolve, 100))
          }

          ;(async () => {
            if (!opts.stdio) return
            for await (const signal of opts.stdio.signalChan()) {
              client.websocket.connection?.ws.send(JSON.stringify({
                type: 'signal',
                data: signal,
              }))
            }
          })()
          ;(async () => {
            if (!opts.stdio) return
            for await (const terminalSize of opts.stdio.terminalSizeChan()) {
              client.websocket.connection?.ws.send(JSON.stringify({
                type: 'terminal-size',
                data: terminalSize,
              }))
            }
          })()
        }

        return await callback(client.trpc)
      } catch (error) {
        disconnect().catch(() => {})
        if (error instanceof ClientAuthError) {
          throw error
        }
        // Improve error messages for common scenarios
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes('Connection refused') || msg.includes('Connect') || msg.includes('ECONNREFUSED')) {
          console.error(`Unable to connect to CTNR API at ${process.env.CTNR_API_URL}. Is the server running? (${msg})`)
        } else if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('Failed to refresh session')) {
          console.error('Authentication failed or session expired. Please log in again (ctnr login).')
        } else {
          console.error(msg || 'An error occurred while executing command.')
        }
        if (globalThis.Deno) {
          Deno.exit(1)
        } else {
          throw new Error('An error occurred while executing command.')
        }
      }
    },
  }
}
