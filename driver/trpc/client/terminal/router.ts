import * as Run from "api/server/core/run.ts";
import * as List from "api/server/core/list.ts";
import * as Attach from "api/server/core/attach.ts";
import * as Route from "api/server/core/route.ts";
import * as Logs from "api/server/core/logs.ts";
import { initTRPC } from "@trpc/server";
import { ClientTerminalContext } from "./context.ts";
import login from "api/client/auth/login-pkce.ts";
import logout from "api/client/auth/logout.ts";

export const trpc = initTRPC.context<ClientTerminalContext>().create();

export const cliRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(login),
  logout: trpc.procedure.mutation(logout),

  // Core procedures
  run: trpc.procedure.meta(Run.Meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      { authenticate: true },
      ({ server }) =>
        server.core.run.mutate({
          ...input,
          publish: input.publish?.map((p) =>
            [p.name, [p.port, p.protocol].filter(Boolean).join("/")].filter(Boolean).join(":")
          ),
        }, {
          signal,
        }),
    )
  ),
  list: trpc.procedure.meta(List.Meta).input(List.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      { authenticate: true },
      ({ server }) =>
        server.core.list.mutate(input, {
          signal,
        }),
    )
  ),
  attach: trpc.procedure.meta(Attach.Meta).input(Attach.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      { authenticate: true },
      ({ server }) =>
        server.core.attach.mutate(input, {
          signal,
        }),
    )
  ),
  route: trpc.procedure.meta(Route.Meta).input(Route.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      { authenticate: true },
      ({ server }) =>
        server.core.route.mutate(input, {
          signal,
        }),
    )
  ),
  logs: trpc.procedure.meta(Logs.Meta).input(Logs.Input).mutation(({ input, signal, ctx }) =>
    ctx.connect(
      { authenticate: true },
      ({ server }) =>
        server.core.logs.mutate(input, {
          signal,
        }),
    )
  ),
});

export type CliRouter = typeof cliRouter;
