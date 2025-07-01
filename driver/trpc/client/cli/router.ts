import * as Run from "api/core/run.ts";
import * as List from "api/core/list.ts";
import * as Attach from "api/core/attach.ts";
import { initTRPC } from "@trpc/server";
import { RemoteCliContext } from "./context.ts";
import { logout, performOAuthFlow } from "./auth.ts";

export const trpc = initTRPC.context<RemoteCliContext>().create();

export const cliRouter = trpc.router({
  // Client authentication procedures
  login: trpc.procedure.mutation(async () => {}),
  logout: trpc.procedure.mutation(logout),

  // Core procedures
  run: trpc.procedure.meta(Run.meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.lazy(({ client }) =>
      client.core.run.mutate(input, {
        signal,
      })
    )
  ),
  list: trpc.procedure.meta(List.meta).input(List.Input).mutation(({ input, signal, ctx }) =>
    ctx.lazy(({ client }) =>
      client.core.list.mutate(input, {
        signal,
      })
    )
  ),
  attach: trpc.procedure.meta(Attach.meta).input(Attach.Input).mutation(({ input, signal, ctx }) =>
    ctx.lazy(({ client }) =>
      client.core.attach.mutate(input, {
        signal,
      })
    )
  ),
});

export type CliRouter = typeof cliRouter;
