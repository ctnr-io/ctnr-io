import { appRouter } from "./router.ts";
import { createCli } from "trpc-cli";

export const ctnr = createCli({
  router: appRouter,
});

ctnr.run();
