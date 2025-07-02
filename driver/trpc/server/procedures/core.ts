import { trpc } from "../trpc.ts";

import * as Run from "api/core/run.ts";
import * as List from "api/core/list.ts";
import * as Attach from "api/core/attach.ts";

export const run = trpc.procedure
  .meta(Run.Meta)
  .input(Run.Input)
  .mutation(({ input, signal, ctx }) => Run.default({ ...ctx, signal })(input));

export const list = trpc.procedure
  .meta(List.Meta)
  .input(List.Input)
  .mutation(({ input, signal, ctx }) => List.default({ ...ctx, signal })(input));

export const attach = trpc.procedure
  .meta(Attach.Meta)
  .input(Attach.Input)
  .mutation(({ input, signal, ctx }) => Attach.default({ ...ctx, signal })(input));
