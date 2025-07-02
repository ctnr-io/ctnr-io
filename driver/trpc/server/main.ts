import "lib/utils.ts";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";

import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as ws from "ws";
import { Buffer } from "node:buffer";
import { bypassWsWebSocketMessageHandler } from "lib/websocket.ts";
import { createAsyncGeneratorListener } from "lib/async-generator.ts";
import { ServerContext, Signals } from "api/context.ts";
import { getKubeClient } from "lib/kube-client.ts";
import { router } from "./router.ts";
// import { verifySupabaseToken } from "lib/supabase.ts";

const kubeClient = await getKubeClient();

function createServerContext(opts: CreateWSSContextFnOptions): ServerContext {
  const abortController = new AbortController();
  const ws = opts.res as ws.WebSocket;

  // Create a generator for terminal size events
  const terminalSizeGenerator = createAsyncGeneratorListener(
    ["terminal-size"] as const,
    (eventType, handler) => {
      bypassWsWebSocketMessageHandler(
        ws,
        (event) => {
          if (event instanceof Buffer) {
            try {
              const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
              if (parsed && parsed.type === eventType) {
                console.debug("Terminal size event received:", parsed.data);
                handler(parsed.data);
                return true;
              }
            } catch {}
          }
          return false;
        },
      );
    },
    () => ws.close(),
    (_eventType, size) => size as { columns: number; rows: number },
  );

  // Create a generator for signal events
  const signalGenerator = createAsyncGeneratorListener(
    ["signal"],
    (eventType, handler) => {
      bypassWsWebSocketMessageHandler(
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
        },
      );
    },
    () => ws.close(),
    (eventType, signal) => signal as Signals,
  );

  const stdio = {
    stdin: new ReadableStream({
      start(controller) {
        bypassWsWebSocketMessageHandler(
          ws,
          (event) => {
            if (event instanceof Buffer) {
              try {
                const parsed = JSON.parse(Buffer.from(event).toString("utf-8"));
                if (parsed && parsed.type === "stdin") {
                  controller.enqueue(new TextEncoder().encode(parsed.data));
                  return true;
                }
                // Handle EOF signal (Ctrl+D) from client
                if (parsed && parsed.type === "stdin-eof") {
                  // Close the stream properly without closing the WebSocket
                  controller.close();
                  return true;
                }
              } catch {}
            }
            return false;
          },
        );
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
    }),
    stderr: new WritableStream({
      write(chunk) {
        // Send as a JSON object that can be parsed by the client
        ws.send(JSON.stringify({
          type: "stderr",
          data: Buffer.from(chunk).toString("utf-8"),
        }));
      },
    }),
    exit: (code: number) => {
      // Send an exit code message to the client
      ws.send(JSON.stringify({
        type: "exit-code",
        code, // Default to 0 if no code is provided
      }));
    },
    setRaw: (value: boolean) => ws.send(JSON.stringify({ type: "set-raw", value })),
    signalChan: () => signalGenerator,
    terminalSizeChan: () => terminalSizeGenerator,
  };

  // const token = opts.req.headers["authorization"]?.replace("Bearer ", "")!;
  // Authenticate with Supabase
  try {
    // const user = await verifySupabaseToken(token);

    const context: ServerContext = {
      ...opts,
      // user,
      signal: abortController.signal,
      stdio,
      kube: {
        client: kubeClient,
      },
      auth: {
        session: null, // Replace with actual session retrieval logic if needed
      }
    };

    return context;
  } catch (error) {
    console.error("Failed to verify Supabase token:", error);
    ws.close(1008, "Authentication failed");
    throw new Error("Authentication failed");
  }
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
  onError: (err: any) => {
    console.error("WebSocket error:", err);
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
