import { initTRPC } from '@trpc/server'
import SuperJSON from 'superjson'
import { TrpcServerContext } from './context.ts'
import { OpenApiMeta } from 'trpc-to-openapi'

export const trpc = initTRPC.meta<OpenApiMeta>().context<TrpcServerContext>().create({
  transformer: SuperJSON,
})
// Create a new tRPC instance
