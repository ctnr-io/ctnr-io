import { trpc } from './trpc.ts'
import { transformQueryProcedure, transformSubscribeProcedure, withServerContext } from './procedures/_utils.ts'

import * as ListVolumes from 'api/handlers/server/storage/volumes/list.ts'
import * as CreateVolume from 'api/handlers/server/storage/volumes/create.ts'
import * as DeleteVolume from 'api/handlers/server/storage/volumes/delete.ts'

export const volumes = {
  // Subscription variants (for streaming/CLI)
  list: trpc.procedure
    .use(withServerContext)
    .meta(ListVolumes.Meta)
    .input(ListVolumes.Input)
    .subscription(transformSubscribeProcedure(ListVolumes.default)),

  create: trpc.procedure
    .use(withServerContext)
    .meta(CreateVolume.Meta)
    .input(CreateVolume.Input)
    .subscription(transformSubscribeProcedure(CreateVolume.default)),

  delete: trpc.procedure
    .use(withServerContext)
    .meta(DeleteVolume.Meta)
    .input(DeleteVolume.Input)
    .subscription(transformSubscribeProcedure(DeleteVolume.default)),

  // Query/Mutation variants (for frontend/direct calls)
  listQuery: trpc.procedure
    .use(withServerContext)
    .meta(ListVolumes.Meta)
    .input(ListVolumes.Input)
    .query(transformQueryProcedure(ListVolumes.default)),

  createMutation: trpc.procedure
    .use(withServerContext)
    .meta(CreateVolume.Meta)
    .input(CreateVolume.Input)
    .mutation(transformQueryProcedure(CreateVolume.default)),

  deleteMutation: trpc.procedure
    .use(withServerContext)
    .meta(DeleteVolume.Meta)
    .input(DeleteVolume.Input)
    .mutation(transformQueryProcedure(DeleteVolume.default)),
}
