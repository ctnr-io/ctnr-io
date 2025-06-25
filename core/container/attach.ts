import { z } from "zod";
import { StdioContext, namespace } from "core/context.ts";
import kubernetes from "util/kube-client.ts";

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

const handleCtrlPCtrlQ = ({ terminal, stdout }: {
  terminal: boolean;
  stdout: WritableStream;
}) => {
  let stdinLastChunk: Uint8Array | null = null;
  const stdoutWriter = stdout.getWriter();
  stdoutWriter.write(`Press Ctrl+P Ctrl+Q to detach.\r\n`);
  stdoutWriter.releaseLock();
  return (
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<any>,
  ): void => {
    if (terminal) {
      // Check for Ctrl+P Ctrl+Q sequence
      if (
        stdinLastChunk?.[0] === 0x10 && chunk[0] === 0x11
      ) {
        // Detach from the container
        controller.terminate();
      } else {
        // Store the last chunk for the next iteration
        stdinLastChunk = chunk;
      }
    }
    // Otherwise, just pass the chunk through
    controller.enqueue(chunk);
  };
};

export default (context: StdioContext) => async (input: Input) => {
  const defer: Array<() => unknown> = [];
  try {
    const { name, interactive = false, terminal = false } = input;

    const tunnel = await kubernetes.CoreV1.namespace(namespace).tunnelPodAttach(name, {
      stdin: interactive,
      tty: terminal,
      stdout: true,
      stderr: true,
      abortSignal: context.signal,
      container: name,
    });

    if (terminal && interactive) {
      const signalChanAsyncGenerator = context.stdio.signalChan();
      defer.push(() => signalChanAsyncGenerator.return());
      (async () => {
        for await (const signal of signalChanAsyncGenerator) {
          switch (signal) {
            case "SIGINT":
              tunnel.ttyWriteSignal("INTR");
              break;
            case "SIGQUIT":
              tunnel.ttyWriteSignal("QUIT");
              break;
          }
        }
      })();
    }

    if (terminal) {
      const terminalSizeAsyncGenerator = context.stdio.terminalSizeChan();
      defer.push(() => terminalSizeAsyncGenerator.return());
      (async () => {
        for await (const terminalSize of terminalSizeAsyncGenerator) {
          tunnel.ttySetSize(terminalSize);
        }
      })();
    }

    if (terminal) {
      context.stdio.setRaw(true);
      defer.push(() => context.stdio.setRaw(false));
    }

    const stdoutWriter = context.stdio.stdout.getWriter();
    stdoutWriter.write(`Container ${name} is running.\r\n`);
    interactive && stdoutWriter.write(`Press ENTER if you don't see a command prompt.\r\n`);
    stdoutWriter.releaseLock();

    const stdioController = new AbortController();
    context.signal?.addEventListener("abort", () => {
      stdioController.abort();
    });
    defer.push(() => {
      context.signal?.removeEventListener("abort", stdioController.abort);
    });

    const handleCtrlPCtrlQStream = new TransformStream({
      transform: handleCtrlPCtrlQ({
        terminal,
        stdout: context.stdio.stdout,
      }),
    });

    defer.push(async () => {
      // Get pod resource
      const podResource = await kubernetes.CoreV1.namespace(namespace).getPod(name);
      // Close the tunnel and clean up resources
      context.stdio.exit(podResource.status?.containerStatuses?.[0]?.state?.terminated?.exitCode || 0);
    });

    // Read logs to display them in the terminal
    await Promise.any([
      context.stdio.stdin.pipeThrough(
        terminal ? handleCtrlPCtrlQStream : new TransformStream(),
      )
        .pipeTo(
          interactive ? tunnel.stdin : context.stdio.stdout,
        ),
      tunnel.stdout.pipeTo(context.stdio.stdout, {
        signal: stdioController.signal,
      }).catch(() => {}),
      tunnel.stderr.pipeTo(context.stdio.stderr, {
        signal: stdioController.signal,
      }).catch(() => {}),
    ]);
  } catch (error) {
    console.debug(`Error in stream processing:`, error);
  } finally {
    console.debug(`Cleaning up resources...`);
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
