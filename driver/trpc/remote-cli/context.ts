import { ClientContext } from "api/context.ts";
import { Buffer } from "node:buffer";
import { bypassWebSocketMessageHandler } from "lib/websocket.ts";
import { TRPCClient } from "@trpc/client";
import { Router } from "../router.ts";

export type CliContext = {
  client: Promise<TRPCClient<Router>>;
};

export function createClientContext(
  opts: ClientContext,
): CliContext {
  return {
    client: (async () => {
      const { wsClient, client } = await import("../client.ts");

      opts.stdio.stdin.pipeTo(
        new WritableStream({
          write(chunk) {
            // Forward stdin data to the WebSocket as a JSON object
            wsClient.connection?.ws.send(JSON.stringify({
              type: "stdin",
              data: Buffer.from(chunk).toString("utf-8"),
            }));
          },
          close() {
            console.log("Stdin stream closed, sending EOF to server.");
            // Send a message to the WebSocket to indicate that stdin has reached EOF (Ctrl+D)
            // Instead of closing the connection, we send a special message
            wsClient.connection?.ws.send(JSON.stringify({
              type: "stdin-eof",
            }));
          },
        }),
      );

      bypassWebSocketMessageHandler(
        wsClient.connection!.ws,
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
        while (!wsClient.connection?.state || wsClient.connection?.state !== "open") {
          // Wait for the WebSocket connection to be established
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        for await (const signal of opts.stdio.signalChan()) {
          wsClient.connection?.ws.send(JSON.stringify({
            type: "signal",
            data: signal,
          }));
        }
      })();

      (async () => {
        while (!wsClient.connection?.state || wsClient.connection?.state !== "open") {
          // Wait for the WebSocket connection to be established
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        for await (const terminalSize of opts.stdio.terminalSizeChan()) {
          wsClient.connection?.ws.send(JSON.stringify({
            type: "terminal-size",
            data: terminalSize,
          }));
        }
      })();
      return client;
    })(),
  };
}
