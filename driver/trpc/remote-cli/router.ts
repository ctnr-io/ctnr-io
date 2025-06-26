import * as Run from "api/core/run.ts";
import * as List from "api/core/list.ts";
import * as Attach from "api/core/attach.ts";
import { client } from "driver/trpc/client.ts";
import { initTRPC } from "@trpc/server";

export const trpc = initTRPC.context().create();

export const cliRouter = trpc.router({
  run: trpc.procedure.meta(Run.meta).input(Run.Input).mutation(({ input, signal }) =>
    client.run.mutate(input, {
      signal,
    })
  ),
  list: trpc.procedure.meta(List.meta).input(List.Input).mutation(({ input, signal }) =>
    client.list.mutate(input, {
      signal,
    })
  ),
  attach: trpc.procedure.meta(Attach.meta).input(Attach.Input).mutation(({ input, signal }) =>
    client.attach.mutate(input, {
      signal,
    })
  ),
});

export type CliRouter = typeof cliRouter;
