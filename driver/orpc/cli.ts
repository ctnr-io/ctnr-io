import { router } from "./router.ts";
import { createCli } from "trpc-cli";

export const ctnr = createCli({
  router,
});

ctnr.run();
