import React, { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { createTrpcClientContext, TrpcClientContext } from 'driver/trpc/client/context.ts'
import type { TRPCServerRouter } from 'driver/trpc/server/router.ts'
import { TRPCClient } from '@trpc/client'

SplashScreen.preventAutoHideAsync()

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<
  TRPCServerRouter
>()

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

// Create client context for
const ExpoTrpcClientContext = React.createContext<TrpcClientContext | null>(
  null,
)

export function useExpoTrpcClientContext(): TrpcClientContext {
  console.log('yolo')
  const context = React.useContext(ExpoTrpcClientContext)
  if (!context) {
    throw new Error(
      'useExpoTrpcClientContext must be used within ExpoTrpcClientProvider',
    )
  }
  return context
}

export function ExpoTrpcClientProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<
    | { ctx: TrpcClientContext; server: TRPCClient<TRPCServerRouter> | null }
    | null
  >(
    null,
  )
  const queryClient = getQueryClient()

  const updateState = async () => {
    console.log('Updating TRPC client context')
    const ctx = await createTrpcClientContext({
      auth: {
        storage: Platform.OS === 'web' ? localStorage : AsyncStorage as unknown as Storage,
      },
      // stdio: {
      //   stdin: new ReadableStream(),
      //   stdout: new WritableStream(),
      //   stderr: new WritableStream(),
      //   exit: () => {},
      //   setRaw: () => {},
      //   signalChan: function* () {
      //     // TODO: Implement signal handling when needed
      //   } as any,
      //   terminalSizeChan: async function* () {
      //     // TODO: Implement terminal size handling when needed
      //   },
      // },
    })
    console.log('TRPC client context updated')
    const server = await (ctx.connect(async (server) => server).catch(() => null))
    setState({
      ctx,
      server,
    })
  }

  useEffect(() => {
    updateState()
  }, [])

  useEffect(() => {
    if (!state) return
    const {
      data: { subscription },
    } = state.ctx.auth.client.onAuthStateChange((_event, _session) => {
      updateState()
    })
    return () => subscription.unsubscribe()
  }, [])

  console.log('Rendering TRPC client provider', state)
  return (
    <QueryClientProvider client={queryClient}>
      {state && (
        <ExpoTrpcClientContext.Provider value={state.ctx}>
          <TRPCProvider queryClient={queryClient} trpcClient={state.server}>
            {children}
          </TRPCProvider>
        </ExpoTrpcClientContext.Provider>
      )}
    </QueryClientProvider>
  )
}
