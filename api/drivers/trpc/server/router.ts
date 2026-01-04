import { trpc } from 'api/drivers/trpc/server/trpc.ts'
import * as core from './procedures/core.ts'
import * as billing from './procedures/billing.ts'
import * as version from './procedures/version.ts'
import * as storage from './procedures/storage.ts'
import * as network from './procedures/network.ts'
import * as tenancy from './procedures/tenancy.ts'

export const router = trpc.router({
  version,
  billing,
  core,
  storage,
  network,
  tenancy,
})

export type TRPCServerRouter = typeof router
