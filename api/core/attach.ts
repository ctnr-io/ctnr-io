import { z } from "zod";
import { ServerContext, namespace } from "api/context.ts";

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

export default (ctx: ServerContext) => async (input: Input) => {
  const defer: Array<() => unknown> = [];
  try {
    const { name, interactive = false, terminal = false } = input;

    const tunnel = await ctx.kube.client.CoreV1.namespace(namespace).tunnelPodAttach(name, {
      stdin: interactive,
      tty: terminal,
      stdout: true,
      stderr: true,
      abortSignal: ctx.signal,
      container: name,
    });

    const signalChanAsyncGenerator = ctx.stdio.signalChan();
    defer.push(() => signalChanAsyncGenerator.return());
    (async () => {
      for await (const signal of signalChanAsyncGenerator) {
        switch (signal) {
          case "SIGINT":
            if (terminal && interactive) {
              tunnel.ttyWriteSignal("INTR");
            }
            break;
          case "SIGQUIT":
            if (terminal && interactive) {
              tunnel.ttyWriteSignal("QUIT");
            }
            break;
        }
      }
    })();

    if (terminal) {
      const terminalSizeAsyncGenerator = ctx.stdio.terminalSizeChan();
      defer.push(() => terminalSizeAsyncGenerator.return());
      (async () => {
        for await (const terminalSize of terminalSizeAsyncGenerator) {
          tunnel.ttySetSize(terminalSize);
        }
      })();
    }

    if (terminal) {
      ctx.stdio.setRaw(true);
      defer.push(() => ctx.stdio.setRaw(false));
    }

    const stdoutWriter = ctx.stdio.stdout.getWriter();
    stdoutWriter.write(`Container ${name} is running.\r\n`);
    interactive && stdoutWriter.write(`Press ENTER if you don't see a command prompt.\r\n`);
    stdoutWriter.releaseLock();

    const stdioController = new AbortController();
    ctx.signal?.addEventListener("abort", () => {
      stdioController.abort();
    });
    defer.push(() => {
      ctx.signal?.removeEventListener("abort", stdioController.abort);
    });

    const handleCtrlPCtrlQStream = new TransformStream({
      transform: handleCtrlPCtrlQ({
        terminal,
        stdout: ctx.stdio.stdout,
      }),
    });

    defer.push(async () => {
      // Get pod resource
      const podResource = await ctx.kube.client.CoreV1.namespace(namespace).getPod(name);
      // Close the tunnel and clean up resources
      ctx.stdio.exit(podResource.status?.containerStatuses?.[0]?.state?.terminated?.exitCode || 0);
    });

    // Read logs to display them in the terminal
    await Promise.any([
      ctx.stdio.stdin.pipeThrough(
        terminal ? handleCtrlPCtrlQStream : new TransformStream(),
      )
        .pipeTo(
          interactive ? tunnel.stdin : ctx.stdio.stdout,
        ),
      tunnel.stdout.pipeTo(ctx.stdio.stdout, {
        signal: stdioController.signal,
      }).catch(() => {}),
      tunnel.stderr.pipeTo(ctx.stdio.stderr, {
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
