import { trpc } from '../trpc.ts'

import * as Run from 'api/server/core/run.ts'
import * as List from 'api/server/core/list.ts'
import * as Attach from 'api/server/core/attach.ts'
import * as Exec from 'api/server/core/exec.ts'
import * as Route from 'api/server/core/route.ts'
import * as Logs from 'api/server/core/logs.ts'
import { ServerResponse } from '../../../../api/_common.ts'
import { ServerContext } from 'ctx/mod.ts'

export type SubscribeProcedureOutput = {
  type: 'function'
  value: string
} | {
  type: 'template'
  value: string
} | {
  type: 'message'
  value: string
} | {
  type: 'raw'
  value: object
}

function transformSubscribeProcedure<Input, Opts extends { ctx: ServerContext; input: Input }>(
  procedure: (opts: Opts) => ServerResponse<Input>,
) {
  return async function* (opts: Opts): AsyncGenerator<SubscribeProcedureOutput, void, unknown> {
    for await (const value of procedure(opts)) {
      if (typeof value === 'function') {
        yield { type: 'function', value: value.toString() }
      } else if (value.constructor.name === 'TemplateClass') {
        yield { type: 'template', value: value.toString() }
      } else if (typeof value === 'string') {
        yield { type: 'message', value: value }
      } else {
        yield { type: 'raw', value: value }
      }
    }
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
