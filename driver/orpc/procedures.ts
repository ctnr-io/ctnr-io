import { os } from "@orpc/server";

import * as Run from "core/container/run.ts";
import { createContext } from "core/context.ts";

export const run = os.meta(Run.meta).input(Run.Input)
  .route({
    method: "POST",
    path: "/run",
  }).handler(
    async function ({ input, signal }) {
      return await Run.default(createContext({ signal }))(input);
    },
  );
