import { z } from "zod";
import { Context, StdioContext } from "core/context.ts";
import kubernetes from "util/kube-client.ts";
import { Buffer } from "node:buffer";

export const meta = {
  aliases: {
    options: {
      interactive: "i",
      terminal: "t",
    },
  },
};

export const Input = z.object({
  name: z.string().describe("Name of the container"),
  interactive: z.boolean().optional().default(false).describe("Run interactively"),
  terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
});

export type Input = z.infer<typeof Input>;

export default (context: StdioContext) => async (input: Input) => {
  const defer: Array<() => unknown> = [];
  try {
    const { name, interactive = false, terminal = false } = input;

    const tunnel = await kubernetes.CoreV1.namespace("default").tunnelPodAttach(name, {
      stdin: interactive,
      tty: terminal,
      stdout: true,
      stderr: true,
      abortSignal: context.signal,
      container: name,
    });

    if (terminal) {
      (async () => {
        const generator = context.stdio.terminalSizeChan();
        defer.push(() => generator.return());
        for await (const terminalSize of generator) {
          tunnel.ttySetSize(terminalSize);
        }
      })();
    }

    console.info(`Attaching to container ${name}...`);

    const stdoutWriter = context.stdio.stdout.getWriter();
    const encoder = new TextEncoder();
    stdoutWriter.write(encoder.encode(`Container ${name} is running.\r\n`));
    interactive && stdoutWriter.write(encoder.encode("Press Ctrl+D to exit.\r\n"));
    interactive && stdoutWriter.write(encoder.encode("Press Ctrl+P Ctrl+Q to detach.\r\n"));
    interactive && stdoutWriter.write(encoder.encode("Press ENTER to send input to the container.\r\n"));
    stdoutWriter.releaseLock();

    // Read logs to display them in the terminal
    await Promise.any([
      interactive && context.stdio.stdin.pipeTo(tunnel.stdin, {
        signal: context.signal,
      }).catch(() => {}),
      tunnel.stdout.pipeTo(context.stdio.stdout, {
        signal: context.signal,
      }).catch(() => {}),
      tunnel.stderr.pipeTo(context.stdio.stderr, {
        signal: context.signal,
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
