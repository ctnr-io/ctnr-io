import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { createAsyncGeneratorListener } from "util/async-generator.ts";

import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as ws from "ws";
import { StdioContext } from "core/context.ts";
import { Buffer } from "node:buffer";
import { router } from "./router.ts";
import { upgradeWSSWebSocket } from "util/trpc-websocket.ts";

export type Router = typeof router;

function createServerContext(opts: CreateWSSContextFnOptions): StdioContext {
  // const token = opts.connectionParams?.token;
  // ... authenticate with Supabase
  // return { user: authenticatedUser };
  const ws = opts.res as ws.WebSocket;

  const terminalSizeGenerator = createAsyncGeneratorListener(
    "terminal-size",
    (eventType, handler) => {
      upgradeWSSWebSocket(
        ws,
        (event) => {
          if (event instanceof Buffer) {
            try {
              const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
              if (parsed && parsed.type === eventType) {
                handler(parsed.data);
                return true;
              }
            } catch {}
          }
          return false;
        }
      );
    },
    () => ws.close(),
    (size: { columns: number; rows: number }) => size,
  )

  return {
    ...opts,
    signal: undefined,
    stdio: {
      stdin: new ReadableStream({
        start(controller) {
          upgradeWSSWebSocket(
            ws,
            (event) => {
              if (event instanceof Buffer) {
                try {
                  const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
                  if (parsed && parsed.type === "stdin") {
                    controller.enqueue(new TextEncoder().encode(parsed.data));
                    return true;
                  }
                } catch {}
              }
              return false;
            },
          );
        },
        cancel() {
          console.debug("Stdin stream cancelled.");
          // Optionally, you can send a message to the WebSocket to indicate that stdin is cancelled
          ws.close();
        },
      }),
      stdout: new WritableStream({
        write(chunk) {
          // Send as a JSON object that can be parsed by the client
          ws.send(JSON.stringify({
            type: "stdout",
            data: Buffer.from(chunk).toString("utf-8"),
          }));
        },
        close() {
          // Optionally, you can send a message to the WebSocket to indicate that stdout is closed
          ws.close();
        },
      }),
      stderr: new WritableStream({
        write(chunk) {
          // Send as a JSON object that can be parsed by the client
          ws.send(JSON.stringify({
            type: "stderr",
            data: Buffer.from(chunk).toString("utf-8"),
          }));
        },
        close() {
          console.debug("Stderr stream closed.");
          // Optionally, you can send a message to the WebSocket to indicate that stderr is closed
          ws.close();
        },
      }),
      terminalSizeChan: () => terminalSizeGenerator,
    },
  };
}

const wss = new ws.WebSocketServer({
  port: 3000,
});
const handler = applyWSSHandler({
  wss,
  router,
  createContext: createServerContext,
  // Enable heartbeat messages to keep connection open (disabled by default)
  keepAlive: {
    enabled: true,
    // server ping message interval in milliseconds
    pingMs: 30000,
    // connection is terminated if pong message is not received in this many milliseconds
    pongWaitMs: 5000,
  },
});

wss.on("connection", (ws) => {
  console.info(`➕➕ Connection (${wss.clients.size})`);
  ws.once("close", () => {
    console.info(`➖➖ Connection (${wss.clients.size})`);
  });
});

console.info("✅ WebSocket Server listening on ws://localhost:3000");
process.on("SIGTERM", () => {
  console.info("SIGTERM");
  handler.broadcastReconnectNotification();
  wss.close();
});
