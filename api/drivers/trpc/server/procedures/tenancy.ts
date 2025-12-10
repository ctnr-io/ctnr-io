import { trpc } from '../trpc.ts'

import { transformQueryProcedure, transformSubscribeProcedure, withServerContext } from './_utils.ts'
import * as ListProject from 'api/handlers/server/tenancy/project/list.ts'
import * as GetProject from 'api/handlers/server/tenancy/project/get.ts'

export const project = {
  list: trpc.procedure
    .use(withServerContext)
    .meta(ListProject.Meta)
    .input(ListProject.Input)
    .query(transformQueryProcedure(ListProject.default)),

  get: trpc.procedure
    .use(withServerContext)
    .meta(GetProject.Meta)
    .input(GetProject.Input)
    .query(transformQueryProcedure(GetProject.default)),
}
