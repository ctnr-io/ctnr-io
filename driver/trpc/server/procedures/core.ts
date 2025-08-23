import { trpc } from '../trpc.ts'

import * as Run from 'api/server/core/run.ts'
import * as List from 'api/server/core/list.ts'
import * as Attach from 'api/server/core/attach.ts'
import * as Exec from 'api/server/core/exec.ts'
import * as Route from 'api/server/core/route.ts'
import * as Logs from 'api/server/core/logs.ts'
import { ServerResponse } from 'api/_common.ts'
import { ServerContext } from 'ctx/mod.ts'

export type SubscribeProcedureOutput<Output> = {
  type: 'yield'
  value: string
} | {
  type: 'return'
  value: Output
}

function transformSubscribeProcedure<Input, Output, Opts extends { ctx: ServerContext; input: Input }>(
  procedure: (opts: Opts) => ServerResponse<Output>,
) {
  return async function* (opts: Opts): AsyncGenerator<SubscribeProcedureOutput<Output>, void, unknown> {
     const gen = procedure(opts)
    let result = await gen.next();
    while (!result.done) {
      yield { type: 'yield', value: result.value };
      result = await gen.next();
    }
    yield { type: 'return', value: result.value };
    await opts.ctx.defer.run()
  }
}

export const run = trpc.procedure
  .meta(Run.Meta)
  .input(Run.Input)
  .subscription(transformSubscribeProcedure(Run.default))

export const list = trpc.procedure
  .meta(List.Meta)
  .input(List.Input)
  .subscription(transformSubscribeProcedure(List.default))

export const attach = trpc.procedure
  .meta(Attach.Meta)
  .input(Attach.Input)
  .subscription(transformSubscribeProcedure(Attach.default))

export const exec = trpc.procedure
  .meta(Exec.Meta)
  .input(Exec.Input)
  .subscription(transformSubscribeProcedure(Exec.default))

export const route = trpc.procedure
  .meta(Route.Meta)
  .input(Route.Input)
  .subscription(transformSubscribeProcedure(Route.default))

export const logs = trpc.procedure
  .meta(Logs.Meta)
  .input(Logs.Input)
  .mutation(Logs.default)
