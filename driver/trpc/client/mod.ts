import 'lib/utils.ts'
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from '@trpc/client'
import { TRPCServerRouter } from 'driver/trpc/server/router.ts'
import SuperJSON from 'superjson'

export async function createTRPCWebSocketClient({
  url,
  accessToken,
  refreshToken,
}: {
  url: string
  accessToken?: string
  refreshToken?: string
}): Promise<{
  websocket: ReturnType<typeof createWSClient>
  trpc: TRPCClient<TRPCServerRouter>
}> {
  const { promise, resolve, reject } = Promise.withResolvers<void>()

  const wsClient = createWSClient({
    url,
    connectionParams: () => {
      return {
        accessToken,
        refreshToken,
      }
    },
    WebSocket: globalThis.WebSocket,
    onError() {
      console.error('WebSocket error occurred.')
    },
    onOpen() {
      // Handle WebSocket open event
      console.debug('WebSocket connection established.')
      resolve()
    },
    onClose(cause = { code: 1000 }) {
      const { reason, code } = cause as { reason?: string; code: number }
      // Never retry connection on close
      if (code !== 1000) { // 1000 is normal closure
        console.error(reason || 'Unexpected error')
        reject(new Error(reason))
        // Deno.exit(code)
      } else {
        resolve()
        // Deno.exit(0)
      }
    },
  })

  await promise

  const trpcClient = createTRPCClient<TRPCServerRouter>({
    links: [wsLink({
      client: wsClient,
      transformer: SuperJSON,
    })],
  }) as TRPCClient<TRPCServerRouter>
  return {
    websocket: wsClient,
    trpc: trpcClient,
  }
}
