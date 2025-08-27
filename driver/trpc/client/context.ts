import { TRPCClient } from '@trpc/client'
import { createClientContext } from 'ctx/client/mod.ts'
import { bypassWebSocketMessageHandler } from 'lib/websocket.ts'
import { ClientContext } from 'ctx/mod.ts'
import type { TRPCServerRouter } from 'driver/trpc/server/router.ts'
import { createTRPCWebSocketClient } from './mod.ts'
import process from 'node:process'

export type TrpcClientContext = ClientContext & {
  /**
   * This function prevent to start websocket connection until the first call to `connect`
   * This is useful to avoid unnecessary WebSocket connections when running commands that do not require it like --help.
   */
  connect: <R>(
    callback: (server: TRPCClient<TRPCServerRouter>) => Promise<R>,
  ) => Promise<R>
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
  return {
    ...ctx,
    connect: async (callback) => {
      try {
        const { data: { session } } = await ctx.auth.client.refreshSession()
        if (!session) {
          throw new Error('Failed to refresh session. Please log in again.')
        }

        const client = await createTRPCWebSocketClient({
          url: process.env.CTNR_API_URL!,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        })

        if (opts.stdio) {
          const decoder = new TextDecoder('utf-8')
          opts.stdio.stdin.pipeTo(
            new WritableStream({
              write(chunk) {
                // Forward stdin data to the WebSocket as a JSON object
                client.websocket.connection?.ws.send(JSON.stringify({
                  type: 'stdin',
                  data: decoder.decode(new Uint8Array(chunk)),
                }))
              },
              close() {
                // Send a message to the WebSocket to indicate that stdin has reached EOF (Ctrl+D)
                // Instead of closing the connection, we send a special message
                client.websocket.connection?.ws.send(JSON.stringify({
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
        if (globalThis.Deno) {
          console.error(error instanceof Error ? error.message : 'An error occurred while executing command.')
          Deno.exit(1)
        } else {
          throw error
        }
      }
    },
  }
}
