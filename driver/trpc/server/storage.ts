import { trpc } from './trpc.ts'
import { transformQueryProcedure, withServerContext } from './procedures/_utils.ts'

import * as ListVolumes from 'api/server/storage/volumes/list.ts'
import * as CreateVolume from 'api/server/storage/volumes/create.ts'
import * as DeleteVolume from 'api/server/storage/volumes/delete.ts'

export const volumes = {
  list: trpc.procedure
    .use(withServerContext)
    .meta(ListVolumes.Meta)
    .input(ListVolumes.Input)
    .query(transformQueryProcedure(ListVolumes.default)),

  create: trpc.procedure
    .use(withServerContext)
    .meta(CreateVolume.Meta)
    .input(CreateVolume.Input)
    .mutation(transformQueryProcedure(CreateVolume.default)),

  delete: trpc.procedure
    .use(withServerContext)
    .meta(DeleteVolume.Meta)
    .input(DeleteVolume.Input)
    .mutation(transformQueryProcedure(DeleteVolume.default)),
}
