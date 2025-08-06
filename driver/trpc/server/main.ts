import "lib/utils.ts";

import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as ws from "ws";
import { router } from "./router.ts";
import { createTrpcServerContext } from "./context.ts";
import process from "node:process";
// import { verifySupabaseToken } from "lib/supabase.ts";

const wss = new ws.WebSocketServer({
  port: 3000,
});
const handler = applyWSSHandler({
  wss,
  router,
  createContext: createTrpcServerContext,
  // Enable heartbeat messages to keep connection open (disabled by default)
  keepAlive: {
    enabled: true,
    // server ping message interval in milliseconds
    pingMs: 1000,
    // connection is terminated if pong message is not received in this many milliseconds
    pongWaitMs: 1000,
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
