import { trpc } from "../trpc.ts";

import * as Run from "api/server/core/run.ts";
import * as List from "api/server/core/list.ts";
import * as Attach from "api/server/core/attach.ts";

export const run = trpc.procedure
  .meta(Run.Meta)
  .input(Run.Input)
  .mutation(Run.default);

export const list = trpc.procedure
  .meta(List.Meta)
  .input(List.Input)
  .mutation(List.default);

export const attach = trpc.procedure
  .meta(Attach.Meta)
  .input(Attach.Input)
  .mutation(Attach.default);

