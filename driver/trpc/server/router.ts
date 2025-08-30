import { trpc } from 'driver/trpc/server/trpc.ts'
import * as core from './procedures/core.ts'
import * as billing from './procedures/billing.ts'

export const router = trpc.router({
  billing,
  core,
})

export type TRPCServerRouter = typeof router
