import { Context, StdioContext } from "api/context.ts";
import { Buffer } from "node:buffer";
import { bypassWebSocketMessageHandler } from "lib/websocket.ts";
import { createWSClient } from "@trpc/client";

export function createClientContext(
  opts: {
    wsClient: ReturnType<typeof createWSClient>;
  } & StdioContext,
): Context {

  opts.stdio.stdin.pipeTo(
    new WritableStream({
      write(chunk) {
        // Forward stdin data to the WebSocket as a JSON object
        opts.wsClient.connection?.ws.send(JSON.stringify({
          type: "stdin",
          data: Buffer.from(chunk).toString("utf-8"),
        }));
      },
      close() {
        console.log("Stdin stream closed, sending EOF to server.");
        // Send a message to the WebSocket to indicate that stdin has reached EOF (Ctrl+D)
        // Instead of closing the connection, we send a special message
        opts.wsClient.connection?.ws.send(JSON.stringify({
          type: "stdin-eof",
        }));
      },
    }),
  );

  bypassWebSocketMessageHandler(
    opts.wsClient.connection!.ws,
    (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "stdout") {
          const stdoutWriter = opts.stdio.stdout.getWriter();
          stdoutWriter.write(new TextEncoder().encode(parsed.data));
          stdoutWriter.releaseLock();
          return true;
        }
        if (parsed.type === "stderr") {
          const stderrWriter = opts.stdio.stderr.getWriter();
          stderrWriter.write(new TextEncoder().encode(parsed.data));
          stderrWriter.releaseLock();
          return true;
        }
        if (parsed.type === "set-raw") {
          opts.stdio.setRaw(parsed.value);
          return true;
        }
        if (parsed.type === "exit-code") {
          // Handle exit code message from server
          // Exit the process with the received exit code
          opts.stdio.exit(parsed.code);
          return true;
        }
      } catch (e) {
      }
      return false;
    },
  );

  (async () => {
    while (!opts.wsClient.connection?.state || opts.wsClient.connection?.state !== "open") {
      // Wait for the WebSocket connection to be established
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    for await (const signal of opts.stdio.signalChan()) {
      opts.wsClient.connection?.ws.send(JSON.stringify({
        type: "signal",
        data: signal,
      }));
    }
  })();

  (async () => {
    while (!opts.wsClient.connection?.state || opts.wsClient.connection?.state !== "open") {
      // Wait for the WebSocket connection to be established
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Send the initial terminal size
    opts.wsClient.connection?.ws.send(JSON.stringify({
      type: "terminal-size",
      data: Deno.consoleSize(),
    }));
    for await (const terminalSize of opts.stdio.terminalSizeChan()) {
      opts.wsClient.connection?.ws.send(JSON.stringify({
        type: "terminal-size",
        data: terminalSize,
      }));
    }
  })();

  return {
    signal: undefined,
  };
}
