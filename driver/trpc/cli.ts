import { createAsyncGeneratorListener } from "util/async-generator.ts";
import { router } from "./router.ts";
import { createCli } from "trpc-cli";

export const ctnr = createCli({
  router,
  context: {
    signal: undefined,
    stdio: {
      stdin: Deno.stdin.readable,
      stdout: Deno.stdout.writable,
      stderr: Deno.stderr.writable,
      terminalSizeChan: async function* () {
        if (!Deno.stdin.isTerminal()) {
          return;
        }
        // Send the initial terminal size
        yield Deno.consoleSize();
        // Send terminal size updates
        yield* createAsyncGeneratorListener(
          "SIGWINCH",
          Deno.addSignalListener,
          Deno.removeSignalListener,
          Deno.consoleSize,
        );
      },
    },
  }
});

ctnr.run();
