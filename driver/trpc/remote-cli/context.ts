import { Context, Signals } from "core/context.ts";
import { Buffer } from "node:buffer";
import { bypassWebSocketMessageHandler } from "util/websocket.ts";
import { createWSClient } from "@trpc/client";
import { wsClient } from "../client.ts";

export function createClientContext(
  opts: {
    wsClient: ReturnType<typeof createWSClient>;
    stdin: ReadableStream;
    stdout: WritableStream;
    stderr: WritableStream;
    setRaw: (value: boolean) => void,
    signalChan: () => AsyncGenerator<Signals>;
    terminalSizeChan: () => AsyncGenerator<{ columns: number; rows: number }>;
  },
): Context {

  opts.stdin.pipeTo(
    new WritableStream({
      write(chunk) {
        // Forward stdin data to the WebSocket as a JSON object
        opts.wsClient.connection?.ws.send(JSON.stringify({
          type: "stdin",
          data: Buffer.from(chunk).toString("utf-8"),
        }));
      },
      close() {
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
          const stdoutWriter = opts.stdout.getWriter();
          stdoutWriter.write(new TextEncoder().encode(parsed.data));
          stdoutWriter.releaseLock();
          return true;
        }
        if (parsed.type === "stderr") {
          const stderrWriter = opts.stderr.getWriter();
          stderrWriter.write(new TextEncoder().encode(parsed.data));
          stderrWriter.releaseLock();
          return true;
        }
        if (parsed.type === "set-raw") {
          opts.setRaw(parsed.value);
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
    for await (const signal of opts.signalChan()) {
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
    for await (const terminalSize of opts.terminalSizeChan()) {
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
