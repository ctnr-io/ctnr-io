import { trpc } from 'driver/trpc/server/trpc.ts'
import * as core from './procedures/core.ts'
import * as billing from './procedures/billing.ts'
import * as version from './procedures/version.ts'
import * as storage from './storage.ts'
import * as network from './network.ts'

export const router = trpc.router({
  version,
  billing,
  core,
  storage,
  network,
})

export type TRPCServerRouter = typeof router
