import { trpc } from 'driver/trpc/server/trpc.ts'
import * as core from './procedures/core.ts'

export const router = trpc.router({
  core,
})

export type TRPCServerRouter = typeof router
