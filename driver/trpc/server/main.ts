import 'lib/utils.ts'

import { applyWSSHandler } from '@trpc/server/adapters/ws'
import * as ws from 'ws'
import { createServer, Server } from 'node:http'
import { router } from './router.ts'
import { createTrpcServerContext } from './context.ts'
import process from 'node:process'
// import { verifySupabaseToken } from "lib/supabase.ts";

const httpServer = createServer()

const websocketServer = new ws.WebSocketServer({
  server: httpServer,
})

const websocketHandler = applyWSSHandler({
  wss: websocketServer,
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
})

websocketServer.on('connection', (ws) => {
  console.info(`➕➕ Websocket Connection (${websocketServer.clients.size})`)
  ws.once('close', () => {
    console.info(`➖➖ Websocket Connection (${websocketServer.clients.size})`)
  })
})

process.on('SIGTERM', () => {
  console.info('SIGTERM')
  websocketHandler.broadcastReconnectNotification()
  websocketServer.close()
})


httpServer.listen(3000)

console.info(`✅ HTTP Server listening on http://localhost:3000`)
