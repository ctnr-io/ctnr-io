import "lib/utils.ts";
import { createCli } from "trpc-cli";
import { createTrpcClientTerminalContext } from "./context.ts";
import { cliRouter } from "./router.ts";
import { createAsyncGeneratorListener } from "lib/async-generator.ts";

try {
  const clientCli = createCli({
    router: cliRouter,
    name: "ctnr",
    version: Deno.env.get("CTNR_VERSION"),
    description: "ctnr.io Remote CLI",
    context: await createTrpcClientTerminalContext({
      stdio: {
        stdin: Deno.stdin.readable,
        stdout: Deno.stdout.writable,
        stderr: Deno.stderr.writable,
        exit: Deno.exit.bind(Deno),
        setRaw: Deno.stdin.setRaw.bind(Deno.stdin),
        signalChan: function* () {
          // TODO: Implement signal handling when needed
          // Currently disabled to avoid linting issues
          // yield* createAsyncGeneratorListener(
          //   [
          //     "SIGINT",
          //     "SIGQUIT",
          //   ] as const,
          //   Deno.addSignalListener,
          //   Deno.removeSignalListener,
          //   (eventType) => eventType,
          // );
        } as any,
        terminalSizeChan: async function* () {
          if (!Deno.stdin.isTerminal()) {
            return;
          }
          // Send the initial terminal size
          yield Deno.consoleSize();
          // Send terminal size updates
          yield* createAsyncGeneratorListener(
            ["SIGWINCH"],
            Deno.addSignalListener,
            Deno.removeSignalListener,
            Deno.consoleSize,
          );
        },
      },
    }),
  });

  await clientCli.run();
} catch (error) {
  console.debug(error);
  console.error("An error occurred while executing command.");
  Deno.exit(1);
}
