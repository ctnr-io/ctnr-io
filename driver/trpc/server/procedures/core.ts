import { trpc } from '../trpc.ts'

import * as List from 'api/server/compute/containers/list.ts'
import * as Attach from 'api/server/compute/containers/attach.ts'
import * as Exec from 'api/server/compute/containers/exec.ts'
import * as Logs from 'api/server/compute/containers/logs.ts'
import * as Remove from 'api/server/compute/containers/remove.ts'
import * as Restart from 'api/server/compute/containers/restart.ts'
import * as Route from 'api/server/compute/containers/route.ts'
import * as Run from 'api/server/compute/containers/run.ts'
import * as Start from 'api/server/compute/containers/start.ts'
import * as Stop from 'api/server/compute/containers/stop.ts'
import { transformQueryProcedure, transformSubscribeProcedure, withServerContext } from './_utils.ts'

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

export const logs = trpc.procedure
  .use(withServerContext)
  .meta(Logs.Meta)
  .input(Logs.Input)
  .subscription(transformSubscribeProcedure(Logs.default))

export const remove = trpc.procedure
  .use(withServerContext)
  .meta(Remove.Meta)
  .input(Remove.Input)
  .subscription(transformSubscribeProcedure(Remove.default))

export const removeMutation = trpc.procedure
  .use(withServerContext)
  .meta(Remove.Meta)
  .input(Remove.Input)
  .mutation(transformQueryProcedure(Remove.default))

export const restart = trpc.procedure
  .use(withServerContext)
  .meta(Restart.Meta)
  .input(Restart.Input)
  .subscription(transformSubscribeProcedure(Restart.default))

export const restartMutation = trpc.procedure
  .use(withServerContext)
  .meta(Restart.Meta)
  .input(Restart.Input)
  .mutation(transformQueryProcedure(Restart.default))

export const route = trpc.procedure
  .use(withServerContext)
  .meta(Route.Meta)
  .input(Route.Input)
  .subscription(transformSubscribeProcedure(Route.default))

export const run = trpc.procedure
  .use(withServerContext)
  .meta(Run.Meta)
  .input(Run.Input)
  .subscription(transformSubscribeProcedure(Run.default))

export const runMutation = trpc.procedure
  .use(withServerContext)
  .meta(Run.Meta)
  .input(Run.Input)
  .mutation(transformQueryProcedure(Run.default))

export const start = trpc.procedure
  .use(withServerContext)
  .meta(Start.Meta)
  .input(Start.Input)
  .subscription(transformSubscribeProcedure(Start.default))

export const startMutation = trpc.procedure
  .use(withServerContext)
  .meta(Start.Meta)
  .input(Start.Input)
  .mutation(transformQueryProcedure(Start.default))

export const stop = trpc.procedure
  .use(withServerContext)
  .meta(Stop.Meta)
  .input(Stop.Input)
  .subscription(transformSubscribeProcedure(Stop.default))

export const stopMutation = trpc.procedure
  .use(withServerContext)
  .meta(Stop.Meta)
  .input(Stop.Input)
  .mutation(transformQueryProcedure(Stop.default))
