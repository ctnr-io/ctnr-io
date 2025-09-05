import * as Run from 'api/server//compute/containers/run.ts'
import * as List from 'api/server//compute/containers/list.ts'
import * as Attach from 'api/server//compute/containers/attach.ts'
import * as Exec from 'api/server//compute/containers/exec.ts'
import * as Route from 'api/server//compute/containers/route.ts'
import * as Logs from 'api/server//compute/containers/logs.ts'
import * as PurchaseCredits from '../../../api/server/billing/purchase_credits.ts'
import * as GetClient from 'api/server/billing/get_client.ts'
import * as GetUsage from 'api/server/billing/get_usage.ts'
import * as GetInvoices from 'api/server/billing/get_invoices.ts'
import * as SetLimits from 'api/server/billing/set_limits.ts'
import { initTRPC } from '@trpc/server'
import { TrpcClientContext } from './context.ts'
import login from 'api/client/auth/login_from_terminal.ts'
import logout from 'api/client/auth/logout.ts'
import { Unsubscribable } from '@trpc/server/observable'
import { ClientContext } from 'ctx/mod.ts'
import { SubscribeProcedureOutput } from '../server/procedures/_utils.ts'

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

function transformGeneratorToMutation<Input, Opts extends { ctx: ClientContext; input: Input }>(
  procedure: (opts: Opts) => any,
) {
  return async function (opts: Opts) {
    for await (const value of procedure(opts)) {
      console.warn(value)
    }
  }
}

export const clientRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(transformGeneratorToMutation(login)),
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
  route: trpc.procedure.meta(Route.Meta).input(Route.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.route.subscribe, { input, signal, ctx }),
    )
  ),
  logs: trpc.procedure.meta(Logs.Meta).input(Logs.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.logs.subscribe, { ctx, input, signal }),
    )
  ),

  // Billing procedures
  purchaseCredits: trpc.procedure.meta(PurchaseCredits.Meta).input(PurchaseCredits.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => server.billing.purchaseCredits.mutate(input, { signal, context: ctx }),
    )
  ),
  getClient: trpc.procedure.meta(GetClient.Meta).input(GetClient.Input).query(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => server.billing.getClient.query(input, { signal, context: ctx }),
    )
  ),

  getInvoices: trpc.procedure.meta(GetInvoices.Meta).input(GetInvoices.Input).query(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => server.billing.getInvoices.query(input, { signal, context: ctx }),
    )
  ),
  getUsage: trpc.procedure.meta(GetUsage.Meta).input(GetUsage.Input).query(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => server.billing.getUsage.query(input, { signal, context: ctx }),
    )
  ),
  setLimits: trpc.procedure.meta(SetLimits.Meta).input(SetLimits.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => server.billing.setLimits.mutate(input, { signal, context: ctx }),
    )
  ),
})

export type clientRouter = typeof clientRouter
