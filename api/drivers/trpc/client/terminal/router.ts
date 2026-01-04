import * as Run from 'api/handlers/server//compute/containers/run.ts'
import * as List from 'api/handlers/server//compute/containers/list.ts'
import * as Attach from 'api/handlers/server//compute/containers/attach.ts'
import * as Exec from 'api/handlers/server//compute/containers/exec.ts'
import * as Remove from 'api/handlers/server//compute/containers/remove.ts'
import * as Restart from 'api/handlers/server//compute/containers/restart.ts'
import * as Rollout from 'api/handlers/server//compute/containers/rollout.ts'
import * as Route from 'api/handlers/server//compute/containers/route.ts'
import * as Logs from 'api/handlers/server//compute/containers/logs.ts'
import * as Start from 'api/handlers/server/compute/containers/start.ts'
import * as Stop from 'api/handlers/server/compute/containers/stop.ts'
import * as Get from 'api/handlers/server/compute/containers/get.ts'
import * as Create from 'api/handlers/server/compute/containers/create.ts'

// Storage handlers
import * as ListVolumes from 'api/handlers/server/storage/volumes/list.ts'
import * as CreateVolume from 'api/handlers/server/storage/volumes/create.ts'
import * as DeleteVolume from 'api/handlers/server/storage/volumes/delete.ts'

// Network handlers
import * as ListDomains from 'api/handlers/server/network/domains/list.ts'
import * as CreateDomain from 'api/handlers/server/network/domains/create.ts'
import * as DeleteDomain from 'api/handlers/server/network/domains/delete.ts'
import * as ListRoutes from 'api/handlers/server/network/routes/list.ts'
import * as CreateRoute from 'api/handlers/server/network/routes/create.ts'
import * as DeleteRoute from 'api/handlers/server/network/routes/delete.ts'

// Tenancy handlers
import * as ListProject from 'api/handlers/server/tenancy/project/list.ts'
import * as GetProject from 'api/handlers/server/tenancy/project/get.ts'

import { initTRPC } from '@trpc/server'
import { TrpcClientContext } from '../context.ts'
import login from 'api/handlers/client/auth/login_from_terminal.ts'
import logout from 'api/handlers/client/auth/logout.ts'
import { Unsubscribable } from '@trpc/server/observable'
import { ClientContext } from 'api/context/mod.ts'
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

  // Core container procedures
  run: trpc.procedure.meta(Run.Meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.run.subscribe, { input, signal, ctx }),
    )
  ),
  create: trpc.procedure.meta(Create.Meta).input(Create.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.run.subscribe, { input, signal, ctx }),
    )
  ),
  list: trpc.procedure.meta(List.Meta).input(List.Input.extend({
    output: List.Input.shape.output.unwrap().default('wide').optional(),
  })).query(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.list.subscribe, { input, signal, ctx }),
    )
  ),
  get: trpc.procedure.meta(Get.Meta).input(Get.Input.extend({
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
  rollout: trpc.procedure.meta(Rollout.Meta).input(Rollout.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      (server) => transformSubscribeResolver(server.core.rollout.subscribe, { ctx, input, signal }),
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

  // Storage volumes procedures
  volumes: trpc.router({
    list: trpc.procedure.meta(ListVolumes.Meta).input(ListVolumes.Input).query(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.storage.volumes.list.query(input),
      )
    ),
    create: trpc.procedure.meta(CreateVolume.Meta).input(CreateVolume.Input).mutation(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.storage.volumes.create.mutate(input),
      )
    ),
    delete: trpc.procedure.meta(DeleteVolume.Meta).input(DeleteVolume.Input).mutation(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.storage.volumes.delete.mutate(input),
      )
    ),
  }),

  // Network domains procedures
  domains: trpc.router({
    list: trpc.procedure.meta(ListDomains.Meta).input(ListDomains.Input).query(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.network.domains.list.query(input),
      )
    ),
    create: trpc.procedure.meta(CreateDomain.Meta).input(CreateDomain.Input).mutation(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.network.domains.create.mutate(input),
      )
    ),
    delete: trpc.procedure.meta(DeleteDomain.Meta).input(DeleteDomain.Input).mutation(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.network.domains.delete.mutate(input),
      )
    ),
  }),

  // Network routes procedures
  routes: trpc.router({
    list: trpc.procedure.meta(ListRoutes.Meta).input(ListRoutes.Input).query(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.network.routes.list.query(input),
      )
    ),
    create: trpc.procedure.meta(CreateRoute.Meta).input(CreateRoute.Input).mutation(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.network.routes.create.mutate(input),
      )
    ),
    delete: trpc.procedure.meta(DeleteRoute.Meta).input(DeleteRoute.Input).mutation(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.network.routes.delete.mutate(input),
      )
    ),
  }),

  // Tenancy project procedures
  project: trpc.router({
    list: trpc.procedure.meta(ListProject.Meta).input(ListProject.Input).query(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.tenancy.project.list.query(input),
      )
    ),
    get: trpc.procedure.meta(GetProject.Meta).input(GetProject.Input).query(({ input, ctx }) =>
      ctx.connect(
        async (server) => await server.tenancy.project.get.query(input),
      )
    ),
  }),
})

export type TRPCCLientTerminalRouter = typeof TRPCCLientTerminalRouter
