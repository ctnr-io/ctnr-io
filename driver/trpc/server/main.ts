import 'lib/utils.ts'

import { applyWSSHandler } from '@trpc/server/adapters/ws'
import * as ws from 'ws'
import { createServer } from 'node:http'
import { router } from './router.ts'
import { createTrpcServerContext } from './context.ts'
import process from 'node:process'
import { createOpenApiHttpHandler } from 'trpc-to-openapi';

// Create tRPC HTTP handler
const httpHandler = createOpenApiHttpHandler({
  router,
  createContext: createTrpcServerContext,
})

const httpServer = createServer((req, res) => {
  console.info(`➕➕ HTTP Request: ${req.method} ${req.url}`)
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }
  
  // Handle health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'ctnr-io-trpc-server' }))
    return
  }

  httpHandler(req, res)
  
  res.on('finish', () => {
    console.info(`➖➖ HTTP Response: ${res.statusCode}`)
  })
})

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
