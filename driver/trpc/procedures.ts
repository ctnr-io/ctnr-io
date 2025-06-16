import { trpc } from "./trpc.ts";

import * as Run from "@ctnr/api/core/run.ts";

export const run = trpc.procedure.input(Run.input).mutation(
  async function ({ input, signal }) {
    for await (const output of Run.default({ signal })(input)) {
      console.info("Output:", output);
    }
  },
);
