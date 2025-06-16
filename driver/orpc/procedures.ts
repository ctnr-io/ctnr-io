import { os } from "@orpc/server";

import * as Run from "@ctnr/api/core/run.ts";

export const run = os.input(Run.input)
  .route({
    method: "POST",
    path: "/run",
  }).handler(
    async function ({ input, signal }) {
      console.log("Running procedure with input:", input);
      for await (const output of Run.default({ signal })(input)) {
        console.log("Output:", output);
      }
    },
  )