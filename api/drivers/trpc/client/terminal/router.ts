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
import z from 'zod'

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

// Generic helper to create subscribe-based query procedures
export function createSubscribeQuery<Input, Output>(
  Meta: any,
  Input: z.ZodType<Input>,
  subscribePath: (server: any) => { subscribe: (input: Input, opts: any) => Unsubscribable },
) {
  return trpc.procedure
    .meta(Meta)
    .input(Input)
    .query(({ input, signal, ctx }) =>
      ctx.connect((server) =>
        transformSubscribeResolver(subscribePath(server).subscribe, { input, signal, ctx })
      )
    )
}

// Generic helper to create subscribe-based mutation procedures
export function createSubscribeMutation<Input, Output>(
  Meta: any,
  Input: z.ZodType<Input>,
  subscribePath: (server: any) => { subscribe: (input: Input, opts: any) => Unsubscribable },
) {
  return trpc.procedure
    .meta(Meta)
    .input(Input)
    .mutation(({ input, signal, ctx }) =>
      ctx.connect((server) =>
        transformSubscribeResolver(subscribePath(server).subscribe, { input, signal, ctx })
      )
    )
}

const WithWideOutputDefault = {
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).default('wide').optional(),
}

export const TRPCCLientTerminalRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(transformQueryProcedure(login)),
  logout: trpc.procedure.mutation(logout),

  // Core container procedures
  run: createSubscribeMutation(Run.Meta, Run.Input, (server) => server.core.run),
  create: createSubscribeMutation(Create.Meta, Create.Input, (server) => server.core.run),
  list: createSubscribeQuery(List.Meta, List.Input.extend(WithWideOutputDefault), (server) => server.core.list),
  get: createSubscribeQuery(Get.Meta, Get.Input.extend(WithWideOutputDefault), (server) => server.core.list),
  attach: createSubscribeMutation(Attach.Meta, Attach.Input, (server) => server.core.attach),
  exec: createSubscribeMutation(Exec.Meta, Exec.Input, (server) => server.core.exec),
  logs: createSubscribeMutation(Logs.Meta, Logs.Input, (server) => server.core.logs),
  remove: createSubscribeMutation(Remove.Meta, Remove.Input, (server) => server.core.remove),
  restart: createSubscribeMutation(Restart.Meta, Restart.Input, (server) => server.core.restart),
  rollout: createSubscribeMutation(Rollout.Meta, Rollout.Input, (server) => server.core.rollout),
  route: createSubscribeMutation(Route.Meta, Route.Input, (server) => server.core.route),
  start: createSubscribeMutation(Start.Meta, Start.Input, (server) => server.core.start),
  stop: createSubscribeMutation(Stop.Meta, Stop.Input, (server) => server.core.stop),

  // // Storage volumes procedures
  // volumes: trpc.router({
  //   list: createSubscribeQuery(
  //     ListVolumes.Meta,
  //     ListVolumes.Input,
  //     (server) => server.storage.volumes.list
  //   ),
  //   create: createSubscribeMutation(
  //     CreateVolume.Meta,
  //     CreateVolume.Input,
  //     (server) => server.storage.volumes.create
  //   ),
  //   delete: createSubscribeMutation(
  //     DeleteVolume.Meta,
  //     DeleteVolume.Input,
  //     (server) => server.storage.volumes.delete
  //   ),
  // }),

  // // Network domains procedures
  // domains: trpc.router({
  //   list: createSubscribeQuery(
  //     ListDomains.Meta,
  //     ListDomains.Input,
  //     (server) => server.network.domains.list
  //   ),
  //   create: createSubscribeMutation(
  //     CreateDomain.Meta,
  //     CreateDomain.Input,
  //     (server) => server.network.domains.create
  //   ),
  //   delete: createSubscribeMutation(
  //     DeleteDomain.Meta,
  //     DeleteDomain.Input,
  //     (server) => server.network.domains.delete
  //   ),
  // }),

  // // Network routes procedures
  // routes: trpc.router({
  //   list: createSubscribeQuery(
  //     ListRoutes.Meta,
  //     ListRoutes.Input,
  //     (server) => server.network.routes.list
  //   ),
  //   create: createSubscribeMutation(
  //     CreateRoute.Meta,
  //     CreateRoute.Input,
  //     (server) => server.network.routes.create
  //   ),
  //   delete: createSubscribeMutation(
  //     DeleteRoute.Meta,
  //     DeleteRoute.Input,
  //     (server) => server.network.routes.delete
  //   ),
  // }),

  // // Tenancy project procedures
  // project: trpc.router({
  //   list: createSubscribeQuery(
  //     ListProject.Meta,
  //     ListProject.Input,
  //     (server) => server.tenancy.project.list
  //   ),
  //   get: createSubscribeQuery(
  //     GetProject.Meta,
  //     GetProject.Input,
  //     (server) => server.tenancy.project.get
  //   ),
  // }),
})

export type TRPCCLientTerminalRouter = typeof TRPCCLientTerminalRouter
