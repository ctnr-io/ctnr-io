import "lib/utils.ts";
import { createAsyncGeneratorListener } from "lib/async-generator.ts";
import { router } from "./procedures/router.ts";
import { createCli } from "trpc-cli";

// Override Deno Streams to permit to send string directly to stdout and stderr
const stdout = new WritableStream({
  write(chunk) {
    if (typeof chunk === "string") {
      chunk = new TextEncoder().encode(chunk);
    }
    Deno.stdout.write(chunk);
  },
  close() {
    Deno.stdout.close();
  },
  abort(reason) {
    console.error("Stdout stream aborted:", reason);
    Deno.stdout.close();
  },
});

const stderr = new WritableStream({
  write(chunk) {
    if (typeof chunk === "string") {
      chunk = new TextEncoder().encode(chunk);
    }
    Deno.stderr.write(chunk);
  },
  close() {
    Deno.stderr.close();
  },
  abort(reason) {
    console.error("Stderr stream aborted:", reason);
    Deno.stderr.close();
  },
});

export const ctnr = createCli({
  router,
  context: {
    signal: undefined,
    kube: {
      client: {} as any, // Placeholder for KubeClient, should be initialized properly
    },
    stdio: {
      stdin: Deno.stdin.readable,
      stdout,
      stderr,
      exit: Deno.exit.bind(Deno),
      setRaw: Deno.stdin.setRaw.bind(Deno.stdin),
      signalChan: async function* () {
        if (!Deno.stdin.isTerminal()) {
          return;
        }
        // yield* createAsyncGeneratorListener(
        //   [
        //     "SIGINT",
        //     "SIGQUIT",
        //   ] as const,
        //   Deno.addSignalListener,
        //   Deno.removeSignalListener,
        //   (eventType) => eventType,
        // );
      },
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
    auth: {
      session: null,
    }
  },
});

ctnr.run();
