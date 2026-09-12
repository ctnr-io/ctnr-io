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
import composeConfig, * as ComposeConfig from 'api/handlers/client/compute/compose/config.ts'
import composeUp, * as ComposeUp from 'api/handlers/client/compute/compose/up.ts'
import composeDown, * as ComposeDown from 'api/handlers/client/compute/compose/down.ts'
import { Unsubscribable } from '@trpc/server/observable'
import { ClientContext } from 'api/context/mod.ts'
import { SubscribeProcedureOutput } from '../../server/procedures/_utils.ts'
import { createDeferer } from 'lib/api/defer.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import { colorStatusLine, red } from 'lib/api/colors.ts'
import { step } from 'lib/api/progress.ts'
import z from 'zod'

export const trpc = initTRPC.context<TrpcClientContext>().create()

// Default sink: progress and final table/status content share the same stdout stream, as before.
const toStdout = (value: unknown) => console.info(typeof value === 'string' ? colorStatusLine(value) : value)
// Progress-only sink for commands that visibly wait (run/start): status lines go to stderr,
// keeping stdout free for `--output json|yaml|name` and TTY-gated no-op like lib/api/colors.ts.
const toStderr = (value: unknown) => typeof value === 'string' ? step(value) : toStdout(value)

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
  print: (value: unknown) => void = toStdout,
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
            print(data.value)
            return
          case 'return':
            result = data.value as Output
            return
        }
      },
    })
  )
}

type TRPClientRequest<Input, Context = ClientContext> = { ctx: Context; input: Input; signal: AbortSignal | undefined }

export function transformQueryProcedure<Input, Output, Context extends ClientContext = ClientContext>(
  procedure: (opts: ClientRequest<Input, Context>) => ClientResponse<Output>,
  print: (value: unknown) => void = toStdout,
) {
  return async function (opts: TRPClientRequest<Input, Context>): Promise<Output> {
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
        print(value)
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(red('❌'), error.message)
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
  opts: { progress?: boolean } = {},
) {
  const print = opts.progress ? toStderr : toStdout
  return trpc.procedure
    .meta(Meta)
    .input(Input)
    .query(({ input, signal, ctx }: any) =>
      ctx.connect((server: any) =>
        transformSubscribeResolver(subscribePath(server).subscribe, { input, signal, ctx }, print)
      )
    )
}

// Generic helper to create subscribe-based mutation procedures
export function createSubscribeMutation<Input, Output>(
  Meta: any,
  Input: z.ZodType<Input>,
  subscribePath: (server: any) => { subscribe: (input: Input, opts: any) => Unsubscribable },
  opts: { progress?: boolean } = {},
) {
  const print = opts.progress ? toStderr : toStdout
  return trpc.procedure
    .meta(Meta)
    .input(Input)
    .mutation(({ input, signal, ctx }: any) =>
      ctx.connect((server: any) =>
        transformSubscribeResolver(subscribePath(server).subscribe, { input, signal, ctx }, print)
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

  // Compose: docker-compose.yaml -> ctnr Stack, deployed onto the cluster
  compose: trpc.router({
    // Local mapping only, no cluster round-trip
    config: trpc.procedure
      .meta(ComposeConfig.Meta)
      .input(ComposeConfig.Input)
      .mutation(transformQueryProcedure(composeConfig)),
    // Creates each service as a container, in dependency order
    up: trpc.procedure
      .meta(ComposeUp.Meta)
      .input(ComposeUp.Input)
      .mutation(transformQueryProcedure(composeUp, toStderr)),
    // Removes each service's container, in reverse dependency order
    down: trpc.procedure
      .meta(ComposeDown.Meta)
      .input(ComposeDown.Input)
      .mutation(transformQueryProcedure(composeDown, toStderr)),
  }),

  // Core container procedures
  run: createSubscribeMutation(Run.Meta, Run.Input, (server) => server.core.run, { progress: true }),
  create: createSubscribeMutation(Create.Meta, Create.Input, (server) => server.core.run),
  list: createSubscribeQuery(List.Meta, List.Input.extend(WithWideOutputDefault), (server) => server.core.list),
  ps: createSubscribeQuery(List.Meta, List.Input.extend(WithWideOutputDefault), (server) => server.core.list),
  get: createSubscribeQuery(Get.Meta, Get.Input.extend(WithWideOutputDefault), (server) => server.core.list),
  inspect: createSubscribeQuery(Get.Meta, Get.Input.extend(WithWideOutputDefault), (server) => server.core.list),
  attach: createSubscribeMutation(Attach.Meta, Attach.Input, (server) => server.core.attach),
  exec: createSubscribeMutation(Exec.Meta, Exec.Input, (server) => server.core.exec),
  logs: createSubscribeMutation(Logs.Meta, Logs.Input, (server) => server.core.logs),
  remove: createSubscribeMutation(Remove.Meta, Remove.Input, (server) => server.core.remove),
  rm: createSubscribeMutation(Remove.Meta, Remove.Input, (server) => server.core.remove),
  restart: createSubscribeMutation(Restart.Meta, Restart.Input, (server) => server.core.restart),
  rollout: createSubscribeMutation(Rollout.Meta, Rollout.Input, (server) => server.core.rollout),
  route: createSubscribeMutation(Route.Meta, Route.Input, (server) => server.core.route),
  start: createSubscribeMutation(Start.Meta, Start.Input, (server) => server.core.start, { progress: true }),
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
