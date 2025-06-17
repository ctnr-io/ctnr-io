import { z } from "zod";
import { Context } from "core/context.ts";
import kubernetes from "util/kube-client.ts";

export const meta = {
  aliases: {
    options: {
      interactive: "i",
      terminal: "t",
    },
  },
};

export const Input = z.tuple([
  z.string().describe("Name of the container"),
  z.object({
    interactive: z.boolean().optional().default(false).describe("Run interactively"),
    terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
  }),
]);

export type Input = z.infer<typeof Input>;

export default (context: Context) => async (input: Input) => {
  const defer: Array<() => unknown> = [];
  try {
    const [name, { interactive = false, terminal = false }] = input;

    const tunnel = await kubernetes.CoreV1.namespace("default").tunnelPodAttach(name, {
      stdin: interactive,
      tty: terminal,
      stdout: true,
      stderr: true,
      abortSignal: context.signal,
      container: name,
    });

    // Create an AbortController to manage all streams
    if (interactive) {
      if (Deno.stdin.isTerminal()) {
        Deno.stdin.setRaw(true);
      }

      // Ensure the tunnel is ready before piping stdin
      await tunnel.ready;

      // Set the initial terminal size
      tunnel.ttySetSize(Deno.consoleSize());
      const resizeHandler = () => tunnel.ttySetSize(Deno.consoleSize());
      Deno.addSignalListener("SIGWINCH", resizeHandler);
      defer.push(() => Deno.removeSignalListener("SIGWINCH", resizeHandler));
    }

    console.info(`Container ${name} is running. Press Ctrl+D to exit. Press Ctrl+P Ctrl+Q to detach.`);
    interactive && console.info("Press ENTER to send input to the container.");

    // Read logs to display them in the terminal
    await Promise.any([
      interactive && Deno.stdin.readable.pipeTo(tunnel.stdin, {
        signal: context.signal,
        preventClose: true,
      }).catch(() => {}),
      tunnel.stdout.pipeTo(Deno.stdout.writable, {
        signal: context.signal,
        preventClose: true,
      }).catch(() => {}),
      tunnel.stderr.pipeTo(Deno.stderr.writable, {
        signal: context.signal,
        preventClose: true,
      }).catch(() => {}),
    ]);
  } catch (error) {
    console.debug(`Error in stream processing:`, error);
  } finally {
    // Run cleanup functions in reverse order
    for (const deferFn of defer.toReversed()) {
      try {
        await deferFn();
      } catch (error) {
        console.debug(`Error in cleanup:`, error);
      }
    }
  }
};
