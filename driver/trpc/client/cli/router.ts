import * as Run from "api/core/run.ts";
import * as List from "api/core/list.ts";
import * as Attach from "api/core/attach.ts";
import { initTRPC } from "@trpc/server";
import { RemoteCliContext } from "./context.ts";
import { logout, performOAuthFlowOnce } from "./auth.ts";

export const trpc = initTRPC.context<RemoteCliContext>().create();

export const cliRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(({ ctx }) =>
    ctx.lazy(
      { authenticate: true },
      async () => {},
    )
  ),
  logout: trpc.procedure.mutation(({ ctx }) =>
    ctx.lazy(
      { authenticate: false },
      async ({ client }) => {
        await client.auth.logout.mutate();
        await logout();
      },
    )
  ),

  // Core procedures
  run: trpc.procedure.meta(Run.Meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.lazy(
      { authenticate: true },
      ({ client }) =>
        client.core.run.mutate(input, {
          signal,
        }),
    )
  ),
  list: trpc.procedure.meta(List.Meta).input(List.Input).mutation(({ input, signal, ctx }) =>
    ctx.lazy(
      { authenticate: true },
      ({ client }) =>
        client.core.list.mutate(input, {
          signal,
        }),
    )
  ),
  attach: trpc.procedure.meta(Attach.Meta).input(Attach.Input).mutation(({ input, signal, ctx }) =>
    ctx.lazy(
      { authenticate: true },
      ({ client }) =>
        client.core.attach.mutate(input, {
          signal,
        }),
    )
  ),
});

export type CliRouter = typeof cliRouter;
