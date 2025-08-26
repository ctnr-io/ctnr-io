import { trpc } from '../trpc.ts'

import * as Run from 'api/server/core/run.ts'
import * as List from 'api/server/core/list.ts'
import * as Attach from 'api/server/core/attach.ts'
import * as Exec from 'api/server/core/exec.ts'
import * as Route from 'api/server/core/route.ts'
import * as Logs from 'api/server/core/logs.ts'
import { ServerRequest, ServerResponse } from 'api/_common.ts'
import { ServerContext } from 'ctx/mod.ts'
import { createDeferer } from 'lib/defer.ts'

export type SubscribeProcedureOutput<Output> = {
  type: 'yield'
  value: string
} | {
  type: 'return'
  value?: Output
}

type TRPCServerRequest<Input> = { ctx: ServerContext; input: Input; signal: AbortSignal | undefined }

function transformSubscribeProcedure<Input, Output>(
  procedure: (opts: ServerRequest<Input>) => ServerResponse<Output>,
) {
  return async function* (
    opts: TRPCServerRequest<Input>,
  ): AsyncGenerator<SubscribeProcedureOutput<Output>, void, unknown> {
    if (!opts.signal) {
      throw new Error('AbortSignal is required')
    }
    const defer = createDeferer()
    try {
      const gen = procedure({
        ctx: opts.ctx,
        input: opts.input,
        signal: opts.signal,
        defer,
      })
      let result = await gen.next()
      while (!result.done) {
        yield { type: 'yield', value: result.value }
        result = await gen.next()
      }
      yield { type: 'return', value: result.value }
    } finally {
      await defer.execute()
    }
  }
}

function transformQueryProcedure<Input, Output>(
  procedure: (opts: ServerRequest<Input>) => ServerResponse<Output>,
) {
  return async function (opts: TRPCServerRequest<Input>): Promise<Output> {
    if (!opts.signal) {
      throw new Error('AbortSignal is required')
    }
    const defer = createDeferer()
    try {
      const gen = procedure({
        ctx: opts.ctx,
        input: opts.input,
        signal: opts.signal,
        defer,
      })
      let result = await gen.next()
      while (!result.done) {
        result = await gen.next()
      }
      return result.value
    } finally {
      await defer.execute()
    }
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

export const listQuery = trpc.procedure
  .meta(List.Meta)
  .input(List.Input)
  .query(transformQueryProcedure(List.default))

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
  .subscription(transformSubscribeProcedure(Logs.default))
