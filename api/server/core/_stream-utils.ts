import { ServerContext } from "ctx/mod.ts";

export const createCtrlPCtrlQHandler = ({ interactive, terminal, stderr }: {
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

export interface StreamTunnel {
  stdout: ReadableStream;
  stderr: ReadableStream;
  stdin: WritableStream;
  ttySetSize?: (size: { columns: number; rows: number }) => void;
}

export const setupSignalHandling = (
  ctx: ServerContext,
  tunnel: { ttyWriteSignal?: (signal: "INTR" | "QUIT" | "SUSP") => Promise<void> },
  terminal: boolean,
  interactive: boolean,
) => {
  if (terminal) {
    const signalChanAsyncGenerator = ctx.stdio.signalChan();
    ctx.defer(() => signalChanAsyncGenerator.return());
    (async () => {
      for await (const signal of signalChanAsyncGenerator) {
        switch (signal) {
          case "SIGINT":
            if (terminal && interactive) {
              tunnel.ttyWriteSignal?.("INTR");
            }
            break;
          case "SIGQUIT":
            if (terminal && interactive) {
              tunnel.ttyWriteSignal?.("QUIT");
            }
            break;
        }
      }
    })();
  }
};

export const setupTerminalHandling = (
  ctx: ServerContext,
  tunnel: StreamTunnel,
  terminal: boolean,
  interactive: boolean,
) => {
  if (terminal) {
    const terminalSizeAsyncGenerator = ctx.stdio.terminalSizeChan();
    ctx.defer(() => terminalSizeAsyncGenerator.return());
    (async () => {
      for await (const terminalSize of terminalSizeAsyncGenerator) {
        tunnel.ttySetSize?.(terminalSize);
      }
    })();
  }

  if (terminal && interactive) {
    ctx.stdio.setRaw(true);
    ctx.defer(() => ctx.stdio.setRaw(false));
  }
};

export const handleStreams = async (
  ctx: ServerContext,
  tunnel: StreamTunnel,
  interactive: boolean,
  terminal: boolean,
): Promise<void> => {
  const stdioController = new AbortController();
  ctx.signal?.addEventListener("abort", () => {
    stdioController.abort();
  });
  ctx.defer(() => {
    ctx.signal?.removeEventListener("abort", stdioController.abort);
  });

  const handleCtrlPCtrlQStream = new TransformStream({
    transform: createCtrlPCtrlQHandler({
      interactive,
      terminal,
      stderr: ctx.stdio.stderr,
    }),
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
      .pipeTo(interactive ? tunnel.stdin : new WritableStream()).catch(console.debug),
  );

  // Wait for any stream to complete
  const result = await Promise.any(streamPromises);

  console.debug(`Stream processing completed with result:`, result);
};