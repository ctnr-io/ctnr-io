import { trpc } from "./trpc.ts";

import * as Run from "core/container/run.ts";
import * as List from "core/container/list.ts";
import * as Attach from "core/container/attach.ts";

import { createContext } from "core/context.ts";

export const run = trpc.procedure.meta(Run.meta).input(Run.Input).mutation(
  async function ({ input, signal }) {
    return await Run.default(createContext({ signal }))(input)
  }
);

export const list = trpc.procedure.meta(List.meta).input(List.Input).mutation(
  async function ({ input, signal }) {
    return await List.default(createContext({ signal }))(input)
  }
);

export const attach = trpc.procedure.meta(Attach.meta).input(Attach.Input).mutation(
  async function ({ input, signal }) {
    return await Attach.default(createContext({ signal }))(input)
  }
);