import { initTRPC } from '@trpc/server'
import { ServerContext } from 'ctx/mod.ts'
import SuperJSON from 'superjson'

export const trpc = initTRPC.context<ServerContext>().create({
	transformer: SuperJSON 
})
// Create a new tRPC instance
