import { createCli } from "trpc-cli";
import { createClientContext } from "./context.ts";
import { cliRouter } from "./router.ts";
import { wsClient } from "../client.ts";
import { createAsyncGeneratorListener } from "util/async-generator.ts";

if (Deno.stdin.isTerminal()) {
  Deno.stdin.setRaw(true);
}

export const remoteCli = createCli({
  router: cliRouter,
  context: createClientContext({
    // Wait for the WebSocket connection to be established
    wsClient: wsClient,
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
  }),
});

remoteCli.run();
