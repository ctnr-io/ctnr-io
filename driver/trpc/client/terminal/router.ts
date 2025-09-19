import * as Run from 'api/server//compute/containers/run.ts'
import * as List from 'api/server//compute/containers/list.ts'
import * as Attach from 'api/server//compute/containers/attach.ts'
import * as Exec from 'api/server//compute/containers/exec.ts'
import * as Remove from 'api/server//compute/containers/remove.ts'
import * as Restart from 'api/server//compute/containers/restart.ts'
import * as Route from 'api/server//compute/containers/route.ts'
import * as Logs from 'api/server//compute/containers/logs.ts'
import * as Start from 'api/server/compute/containers/start.ts'
import * as Stop from 'api/server/compute/containers/stop.ts'
import { initTRPC } from '@trpc/server'
import { TrpcClientContext } from '../context.ts'
import login from 'api/client/auth/login_from_terminal.ts'
import logout from 'api/client/auth/logout.ts'
import { Unsubscribable } from '@trpc/server/observable'
import { ClientContext } from 'ctx/mod.ts'
import { SubscribeProcedureOutput } from '../../server/procedures/_utils.ts'
import { createDeferer } from 'lib/api/defer.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'

export const trpc = initTRPC.context<TrpcClientContext>().create()

export function transformSubscribeResolver<
  Input,
  Output,
>(
  resolver: (input: Input, opts: {
    signal?: AbortSignal
    onStarted?: () => void
    onError?: (error: Error) => void
    onComplete?: () => void
    onData?: (data: SubscribeProcedureOutput<Output>) => void
    onStopped?: () => void
  }) => Unsubscribable,
  { input, signal }: { ctx: TrpcClientContext; input: Input; signal?: AbortSignal },
): Promise<Output> {
  let result: Output
  return new Promise<Output>((resolve, reject) =>
    resolver(input, {
      signal,
      onError: reject,
      onComplete: () => {
        resolve(result)
      },
      onData: (data: SubscribeProcedureOutput<Output>) => {
        switch (data.type) {
          case 'yield':
            console.info(data.value)
            return
          case 'return':
            result = data.value as Output
            return
        }
      },
    })
  )
}

type TRPClientRequest<Input> = { ctx: ClientContext; input: Input; signal: AbortSignal | undefined }

export function transformQueryProcedure<Input, Output>(
  procedure: (opts: ClientRequest<Input>) => ClientResponse<Output>,
) {
  return async function (opts: TRPClientRequest<Input>): Promise<Output> {
    const defer = createDeferer()
    try {
      const gen = procedure({
        ctx: opts.ctx,
        input: opts.input,
      })
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          return value
        }
        console.info(value)
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌', error.message)
      }
      Deno.exit(1)
    } finally {
      await defer.execute()
    }
  }
}

export const TRPCCLientTerminalRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(transformQueryProcedure(login)),
  logout: trpc.procedure.mutation(logout),

  // Core procedures
  run: trpc.procedure.meta(Run.Meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) =>
        transformSubscribeResolver(server.core.run.subscribe, {
          ctx,
          input: {
            ...input,
            publish: input.publish?.map((p) =>
              [p.name, [p.port, p.protocol].filter(Boolean).join('/')].filter(Boolean).join(':')
            ),
          },
          signal,
        }),
    )
  ),
  list: trpc.procedure.meta(List.Meta).input(List.Input.extend({
    output: List.Input.shape.output.unwrap().default('wide').optional(),
  })).query(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.list.subscribe, { input, signal, ctx }),
    )
  ),
  attach: trpc.procedure.meta(Attach.Meta).input(Attach.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.attach.subscribe, { input, signal, ctx }),
    )
  ),
  exec: trpc.procedure.meta(Exec.Meta).input(Exec.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.exec.subscribe, { input, signal, ctx }),
    )
  ),
  logs: trpc.procedure.meta(Logs.Meta).input(Logs.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.logs.subscribe, { ctx, input, signal }),
    )
  ),
  remove: trpc.procedure.meta(Remove.Meta).input(Remove.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.remove.subscribe, { ctx, input, signal }),
    )
  ),
  restart: trpc.procedure.meta(Restart.Meta).input(Restart.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.restart.subscribe, { ctx, input, signal }),
    )
  ),
  route: trpc.procedure.meta(Route.Meta).input(Route.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.route.subscribe, { input, signal, ctx }),
    )
  ),
  start: trpc.procedure.meta(Start.Meta).input(Start.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.start.subscribe, { ctx, input, signal }),
    )
  ),
  stop: trpc.procedure.meta(Stop.Meta).input(Stop.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.stop.subscribe, { ctx, input, signal }),
    )
  ),
})

export type TRPCCLientTerminalRouter = typeof TRPCCLientTerminalRouter
