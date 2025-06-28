import * as Run from "api/core/run.ts";
import * as List from "api/core/list.ts";
import * as Attach from "api/core/attach.ts";
import { initTRPC } from "@trpc/server";
import { TRPCClient } from "@trpc/client";
import type { Router } from "../router.ts";
import { CliContext } from "./context.ts";

export const trpc = initTRPC.context<CliContext>().create();

export const cliRouter = trpc.router({
  run: trpc.procedure.meta(Run.meta).input(Run.Input).mutation(({ input, signal, ctx }) =>
    ctx.client.then((client) =>
      client.run.mutate(input, {
        signal,
      })
    )
  ),
  list: trpc.procedure.meta(List.meta).input(List.Input).mutation(({ input, signal, ctx }) =>
    ctx.client.then((client) =>
      client.list.mutate(input, {
        signal,
      })
    )
  ),
  attach: trpc.procedure.meta(Attach.meta).input(Attach.Input).mutation(({ input, signal, ctx }) =>
    ctx.client.then((client) =>
      client.attach.mutate(input, {
        signal,
      })
    )
  ),
});

export type CliRouter = typeof cliRouter;
