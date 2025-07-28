import { z } from "zod";
import { ServerContext } from "ctx/mod.ts";
import { ContainerName } from "./_common.ts";

export const Meta = {
  aliases: {
    options: {
      interactive: "i",
      terminal: "t",
    },
  },
};

export const Input = z.object({
  name: ContainerName,
  interactive: z.boolean().optional().default(false).describe("Run interactively"),
  terminal: z.boolean().optional().default(false).describe("Run in a terminal"),
});

export type Input = z.infer<typeof Input>;

const handleCtrlPCtrlQ = ({ interactive, terminal, stderr }: {
  interactive: boolean;
  terminal: boolean;
  stderr: WritableStream;
}) => {
  let stdinLastChunk: Uint8Array | null = null;
  if (terminal && interactive) {
    const stderrWriter = stderr.getWriter();
    stderrWriter.write(`Press Ctrl+P Ctrl+Q to detach.\r\n`);
    stderrWriter.releaseLock();
  }
  return (
    chunk: Uint8Array,
    controller: TransformStreamDefaultController<any>,
  ): void => {
    if (terminal && interactive) {
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

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const defer: Array<() => unknown> = [];
  try {
    const { name, interactive = false, terminal = false } = input;

    const tunnel = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).tunnelPodAttach(name, {
      stdin: interactive,
      tty: terminal,
      stdout: true,
      stderr: true,
      abortSignal: ctx.signal,
      container: name,
    });


    // if (terminal) {
    //   const signalChanAsyncGenerator = ctx.stdio.signalChan();
    //   defer.push(() => signalChanAsyncGenerator.return());
    //   (async () => {
    //     for await (const signal of signalChanAsyncGenerator) {
    //       switch (signal) {
    //         case "SIGINT":
    //           if (terminal && interactive) {
    //             tunnel.ttyWriteSignal("INTR");
    //           }
    //           break;
    //         case "SIGQUIT":
    //           if (terminal && interactive) {
    //             tunnel.ttyWriteSignal("QUIT");
    //           }
    //           break;
    //       }
    //     }
    //   })();
    // }

    if (terminal) {
      const terminalSizeAsyncGenerator = ctx.stdio.terminalSizeChan();
      defer.push(() => terminalSizeAsyncGenerator.return());
      (async () => {
        for await (const terminalSize of terminalSizeAsyncGenerator) {
          tunnel.ttySetSize(terminalSize);
        }
      })();
    }

    if (terminal && interactive) {
      ctx.stdio.setRaw(true);
      defer.push(() => ctx.stdio.setRaw(false));
    }

    const stderrWriter = ctx.stdio.stderr.getWriter();
    stderrWriter.write(`Container ${name} is running.\r\n`);
    interactive && stderrWriter.write(`Press ENTER if you don't see a command prompt.\r\n`);
    stderrWriter.releaseLock();

    const stdioController = new AbortController();
    ctx.signal?.addEventListener("abort", () => {
      stdioController.abort();
    });
    defer.push(() => {
      ctx.signal?.removeEventListener("abort", stdioController.abort);
    });

    const handleCtrlPCtrlQStream = new TransformStream({
      transform: handleCtrlPCtrlQ({
        interactive,
        terminal,
        stderr: ctx.stdio.stderr,
      }),
    });

    defer.push(async () => {
      // Get pod resource
      const podResource = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(name);
      // Close the tunnel and clean up resources
      ctx.stdio.exit(podResource.status?.containerStatuses?.[0]?.state?.terminated?.exitCode || 0);
    });

    // Handle stream connections based on flags
    const streamPromises: Promise<any>[] = [];

    // Always pipe stdout and stderr from container to local streams
    streamPromises.push(
      tunnel.stdout
        .pipeTo(ctx.stdio.stdout, { signal: stdioController.signal })
        .catch(console.debug),
    );

    streamPromises.push(
      tunnel.stderr
        .pipeTo(ctx.stdio.stderr, { signal: stdioController.signal })
        .catch(console.debug),
    );

    streamPromises.push(
      ctx.stdio.stdin
        .pipeThrough(handleCtrlPCtrlQStream)
        // .pipeThrough(handleCtrlCStream)
        .pipeTo(interactive ? tunnel.stdin : new WritableStream()).catch(console.debug),
    );

    // Wait for any stream to complete
    const result = await Promise.any(streamPromises);
    console.debug(`Stream processing completed with result:`, result);
  } catch (error) {
    console.debug(`Error in stream processing:`, error);
    ctx.stdio.exit(1);
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
