import React, { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import {
  ClientAuthError,
  ClientVersionError,
  createTrpcClientContext,
  TrpcClientContext,
} from 'api/drivers/trpc/client/context.ts'
import type { TRPCServerRouter } from 'api/drivers/trpc/server/router.ts'
import { TRPCClient } from '@trpc/client'

// Display env variables on startup
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
  const context = React.useContext(ExpoTrpcClientContext)
  if (!context) {
    throw new Error(
      'useExpoTrpcClientContext must be used within ExpoTrpcClientProvider',
    )
  }
  return context
}

export function ExpoTrpcClientProvider({ children, fallback }: React.PropsWithChildren<{ fallback: React.ReactNode }>) {
  const queryClient = getQueryClient()

  const [{ ctx, server}, setState] = useState<{ ctx: TrpcClientContext | null; server: TRPCClient<TRPCServerRouter> | null }>({ ctx: null, server: null })

  const setCtx = useCallback((ctx: TrpcClientContext | null) => {
    setState((prev) => ({ ...prev, ctx }))
  }, [])

  const setServer = useCallback((server: TRPCClient<TRPCServerRouter> | null) => {
    setState((prev) => ({ ...prev, server }))
  }, [])

  const updateCtx = () => {
    createTrpcClientContext({
      auth: {
        storage: Platform.OS === 'web' ? localStorage : AsyncStorage as unknown as Storage,
      },
    }).then(setCtx)
  }

  // Initialize the TrpcClientContext
  useEffect(() => {
    updateCtx()
  }, [])

  // Subscribe to auth changes to update the context
  useEffect(() => {
    if (!ctx) return
    const {
      data: { subscription },
    } = ctx.auth.client.onAuthStateChange((_event: Event, _session: unknown) => {
      updateCtx()
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [!!ctx])

  // When ctx changes, update the server client
  useEffect(() => {
    if (!ctx) return
    ;(async () => {
      try {
        const server = await ctx.connect((server) => server)
        setServer(server)
      } catch (error: unknown) {
        setServer(null)
        switch (true) {
          case error instanceof ClientVersionError: {
            console.error('Client version is outdated:', error.message)
            // If web, reload the page
            if (Platform.OS === 'web') {
              globalThis.location.reload()
            } else {
              // TODO: implement upgrade flow for mobile
              console.error('Please update the app to the latest version.')
            }
            break
          }
          case error instanceof ClientAuthError: {
            console.error('Authentication error:', error.message)
            break
          }
          case error instanceof Error: {
            console.error('Failed to connect to server:', error.message)
            break
          }
          default:
            break
        }
      }
    })()
    return () => {
      ctx?.disconnect?.()
    }
  }, [ctx])

  console.log({
    ctx,
    server,
  })
  return (
    <QueryClientProvider client={queryClient}>
      {!ctx ? fallback : (
        <ExpoTrpcClientContext.Provider value={ctx}>
          {!server ? fallback : (
            <TRPCProvider queryClient={queryClient} trpcClient={server}>
              {children}
            </TRPCProvider>
          )}
        </ExpoTrpcClientContext.Provider>
      )}
    </QueryClientProvider>
  )
}
