import { trpc } from "./trpc.ts";

import * as Run from "core/container/run.ts";
import * as List from "core/container/list.ts";
import * as Attach from "core/container/attach.ts";

export const run = trpc.procedure.meta(Run.meta).input(Run.Input).mutation(
  async function ({ input, signal, ctx }) {
    return await Run.default({...ctx, signal })(input)
  }
);

export const list = trpc.procedure.meta(List.meta).input(List.Input).mutation(
  async function ({ input, signal, ctx }) {
    return await List.default({ ...ctx, signal })(input)
  }
);

export const attach = trpc.procedure.meta(Attach.meta).input(Attach.Input).mutation(
  async function ({ input, signal, ctx }) {
    return await Attach.default({ ...ctx, signal })(input)
  }
);