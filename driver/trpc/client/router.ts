import * as Run from 'api/server/core/run.ts'
import * as List from 'api/server/core/list.ts'
import * as Attach from 'api/server/core/attach.ts'
import * as Exec from 'api/server/core/exec.ts'
import * as Route from 'api/server/core/route.ts'
import * as Logs from 'api/server/core/logs.ts'
import { initTRPC } from '@trpc/server'
import { TrpcClientContext } from './context.ts'
import login from 'api/client/auth/login-from-terminal.ts'
import logout from 'api/client/auth/logout.ts'
import { Unsubscribable } from '@trpc/server/observable'
import { ClientContext } from 'ctx/mod.ts'
import { SubscribeProcedureOutput } from 'driver/trpc/server/procedures/core.ts'

export const trpc = initTRPC.context<TrpcClientContext>().create()

function transformSubscribeResolver<
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
  { ctx, input, signal }: { ctx: TrpcClientContext; input: Input; signal?: AbortSignal },
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
            console.warn(data.value)
            return
          case 'return':
            result = data.value as Output
            return
        }
      },
    })
  )
}

function transformGeneratorToMutation<Input, Opts extends { ctx: ClientContext; input: Input }>(
  procedure: (opts: Opts) => any,
) {
  return async function (opts: Opts) {
    for await (const value of procedure(opts)) {
      console.warn(value)
    }
  }
}

export const cliRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(transformGeneratorToMutation(login)),
  logout: trpc.procedure.mutation(logout),

  // Core procedures
  run: trpc.procedure.meta(Run.Meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      ({ server }) =>
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
  list: trpc.procedure.meta(List.Meta).input(List.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      ({ server }) => transformSubscribeResolver(server.core.list.subscribe, { input, signal, ctx }),
    )
  ),
  attach: trpc.procedure.meta(Attach.Meta).input(Attach.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      ({ server }) => transformSubscribeResolver(server.core.attach.subscribe, { input, signal, ctx }),
    )
  ),
  exec: trpc.procedure.meta(Exec.Meta).input(Exec.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      ({ server }) => transformSubscribeResolver(server.core.exec.subscribe, { input, signal, ctx }),
    )
  ),
  route: trpc.procedure.meta(Route.Meta).input(Route.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      ({ server }) => transformSubscribeResolver(server.core.route.subscribe, { input, signal, ctx }),
    )
  ),
  logs: trpc.procedure.meta(Logs.Meta).input(Logs.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      ({ server }) =>
        server.core.logs.mutate(input, {
          signal,
        }),
    )
  ),
})

export type CliRouter = typeof cliRouter
