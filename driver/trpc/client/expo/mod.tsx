import React, { useEffect, useState } from 'react'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { ServerRouter } from '../../server/router.ts'

import { createTRPCWebSocketClient } from '../mod.ts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<ServerRouter>()

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

// const ExpoTRPCClientContext = React.createContext<ClientContext>(
//   await createClientContext({
//     auth: {
//       storage: Platform.OS === 'web' ? localStorage : AsyncStorage as unknown as Storage,
//     },
//     stdio: {
//       stdin: new ReadableStream(),
//       stdout: new WritableStream(),
//       stderr: new WritableStream(),
//       exit: () => {},
//       setRaw: () => {},
//       signalChan: function* () {
//         // TODO: Implement signal handling when needed
//         // Currently disabled to avoid linting issues
//         // yield* createAsyncGeneratorListener(
//         //   [
//         //     "SIGINT",
//         //     "SIGQUIT",
//         //   ] as const,
//         //   Deno.addSignalListener,
//         //   Deno.removeSignalListener,
//         //   (eventType) => eventType,
//         // );
//       } as any,
//       terminalSizeChan: async function* () {
//         if (!Deno.stdin.isTerminal()) {
//           return
//         }
//         // Send the initial terminal size
//         const consoleSize = () => {
//           return {
//             columns: 0,
//             rows: 0,
//           }
//         }
//         yield consoleSize()
//         // Send terminal size updates
//         yield* createAsyncGeneratorListener(
//           ['SIGWINCH'],
//           () => {},
//           () => {},
//           consoleSize,
//         )
//       },
//     },
//   }),
// )

export function ExpoTRPCClientProvider({ children }: React.PropsWithChildren) {
  const [trpcClient, setTrpcClient] = useState<Awaited<ReturnType<typeof createTRPCWebSocketClient>>>()
  useEffect(() => {
    ;(async () => {
      console.log('Creating TRPC WebSocket client...')
      try {
        const client = await createTRPCWebSocketClient({
          url: process.env.EXPO_PUBLIC_CTNR_API_URL!
        })
        console.log('TRPC WebSocket client created successfully')
        setTrpcClient(client)
      } catch (error) {
        console.error('Failed to create TRPC WebSocket client:', error)
      }
    })()
  }, [])
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {trpcClient && (
        <TRPCProvider trpcClient={trpcClient?.trpc} queryClient={queryClient}>
          {children}
        </TRPCProvider>
      )}
    </QueryClientProvider>
  )
}
