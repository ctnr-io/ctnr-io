import { trpc } from '../trpc.ts'
import { transformQueryProcedure, transformSubscribeProcedure, withServerContext } from './_utils.ts'

import * as ListDomains from 'api/handlers/server/network/domains/list.ts'
import * as CreateDomain from 'api/handlers/server/network/domains/create.ts'
import * as DeleteDomain from 'api/handlers/server/network/domains/delete.ts'
import * as ListRoutes from 'api/handlers/server/network/routes/list.ts'
import * as CreateRoute from 'api/handlers/server/network/routes/create.ts'
import * as DeleteRoute from 'api/handlers/server/network/routes/delete.ts'

export const domains = {
  // Subscription variants (for streaming/CLI)
  list: trpc.procedure
    .use(withServerContext)
    .meta(ListDomains.Meta)
    .input(ListDomains.Input)
    .subscription(transformSubscribeProcedure(ListDomains.default)),

  create: trpc.procedure
    .use(withServerContext)
    .meta(CreateDomain.Meta)
    .input(CreateDomain.Input)
    .subscription(transformSubscribeProcedure(CreateDomain.default)),

  delete: trpc.procedure
    .use(withServerContext)
    .meta(DeleteDomain.Meta)
    .input(DeleteDomain.Input)
    .subscription(transformSubscribeProcedure(DeleteDomain.default)),

  // Query/Mutation variants (for frontend/direct calls)
  listQuery: trpc.procedure
    .use(withServerContext)
    .meta(ListDomains.Meta)
    .input(ListDomains.Input)
    .query(transformQueryProcedure(ListDomains.default)),

  createMutation: trpc.procedure
    .use(withServerContext)
    .meta(CreateDomain.Meta)
    .input(CreateDomain.Input)
    .mutation(transformQueryProcedure(CreateDomain.default)),

  deleteMutation: trpc.procedure
    .use(withServerContext)
    .meta(DeleteDomain.Meta)
    .input(DeleteDomain.Input)
    .mutation(transformQueryProcedure(DeleteDomain.default)),
}

export const routes = {
  // Subscription variants (for streaming/CLI)
  list: trpc.procedure
    .use(withServerContext)
    .meta(ListRoutes.Meta)
    .input(ListRoutes.Input)
    .subscription(transformSubscribeProcedure(ListRoutes.default)),

  create: trpc.procedure
    .use(withServerContext)
    .meta(CreateRoute.Meta)
    .input(CreateRoute.Input)
    .subscription(transformSubscribeProcedure(CreateRoute.default)),

  delete: trpc.procedure
    .use(withServerContext)
    .meta(DeleteRoute.Meta)
    .input(DeleteRoute.Input)
    .subscription(transformSubscribeProcedure(DeleteRoute.default)),

  // Query/Mutation variants (for frontend/direct calls)
  listQuery: trpc.procedure
    .use(withServerContext)
    .meta(ListRoutes.Meta)
    .input(ListRoutes.Input)
    .query(transformQueryProcedure(ListRoutes.default)),

  createMutation: trpc.procedure
    .use(withServerContext)
    .meta(CreateRoute.Meta)
    .input(CreateRoute.Input)
    .mutation(transformQueryProcedure(CreateRoute.default)),

  deleteMutation: trpc.procedure
    .use(withServerContext)
    .meta(DeleteRoute.Meta)
    .input(DeleteRoute.Input)
    .mutation(transformQueryProcedure(DeleteRoute.default)),
}
