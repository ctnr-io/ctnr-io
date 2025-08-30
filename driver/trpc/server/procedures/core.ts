import { trpc } from '../trpc.ts'

import * as Run from 'api/server/core/run.ts'
import * as List from 'api/server/core/list.ts'
import * as Attach from 'api/server/core/attach.ts'
import * as Exec from 'api/server/core/exec.ts'
import * as Route from 'api/server/core/route.ts'
import * as Logs from 'api/server/core/logs.ts'
import { transformQueryProcedure, transformSubscribeProcedure, withServerContext } from './_utils.ts'

export const run = trpc.procedure
  .use(withServerContext)
  .meta(Run.Meta)
  .input(Run.Input)
  .subscription(transformSubscribeProcedure(Run.default))

export const list = trpc.procedure
  .use(withServerContext)
  .meta(List.Meta)
  .input(List.Input)
  .subscription(transformSubscribeProcedure(List.default))

export const listQuery = trpc.procedure
  .use(withServerContext)
  .meta(List.Meta)
  .input(List.Input)
  .query(transformQueryProcedure(List.default))

export const attach = trpc.procedure
  .use(withServerContext)
  .meta(Attach.Meta)
  .input(Attach.Input)
  .subscription(transformSubscribeProcedure(Attach.default))

export const exec = trpc.procedure
  .use(withServerContext)
  .meta(Exec.Meta)
  .input(Exec.Input)
  .subscription(transformSubscribeProcedure(Exec.default))

export const route = trpc.procedure
  .use(withServerContext)
  .meta(Route.Meta)
  .input(Route.Input)
  .subscription(transformSubscribeProcedure(Route.default))

export const logs = trpc.procedure
  .use(withServerContext)
  .meta(Logs.Meta)
  .input(Logs.Input)
  .subscription(transformSubscribeProcedure(Logs.default))
