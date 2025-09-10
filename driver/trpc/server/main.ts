import 'lib/utils.ts'

import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { router } from './router.ts'
import { createTrpcServerContext } from './context.ts'
import process from 'node:process'
import { createOpenApiHttpHandler } from 'trpc-to-openapi'
import querystring from 'node:querystring'
import { createWorkerContext } from 'ctx/worker/mod.ts'

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
  console.debug(`Handling HTTP request: ${req.method} ${req.url}`, req.headers)

  // Handle all request as JSON
  if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk.toString()
    })

    req.on('end', async () => {
      const parsedBody = querystring.parse(body)
      const jsonBody = JSON.stringify(parsedBody)

      try {
        const response = await fetch('http://localhost:3000' + req.url!, {
          method: req.method,
          // @ts-ignore ignore
          headers: {
            ...req.headers,
            'content-type': 'application/json', // Override content-type header
          },
          body: jsonBody,
        })
        res.writeHead(response.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(await response.json()))
      } catch (err) {
        console.error('Error forwarding request:', err)
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal Server Error' }))
      }
    })
  } else {
    httpHandler(req, res)
  }

  res.on('finish', () => {
    console.info(`➖➖ HTTP Response: ${res.statusCode}`)
  })
})

const websocketServer = new WebSocketServer({
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

// Run worker procedures
async function runWorkerProcedures() {
  try {
    // Create a worker context
    const workerCtx = await createWorkerContext({})

    // Create a minimal tRPC server context for worker procedures (without WebSocket dependencies)
    const mockStdio = {
      stdin: new ReadableStream({
        start(controller) {
          controller.close()
        },
      }),
      stdout: new WritableStream({
        write() {
          // No-op for worker procedures
        },
      }),
      stderr: new WritableStream({
        write() {
          // No-op for worker procedures
        },
      }),
      exit: () => {},
      setRaw: () => {},
      signalChan: () => (async function* () {})(),
      terminalSizeChan: () => (async function* () {})(),
    }

    const serverCtx = {
      auth: {
        accessToken: undefined,
        refreshToken: undefined,
      },
      stdio: mockStdio,
    }

    // Merge worker context into server context
    const ctx = { ...serverCtx, ...workerCtx }
    const caller = router.createCaller(ctx)

    // Get all procedures from the router definition
    const procedures = router._def.procedures

    for (const [name] of Object.entries(procedures)) {
      if (name.match(/[wW]orker$/)) {
        console.info(`🚀 Running worker procedure: ${name}`)
        try {
          // Call the worker procedure with proper typing
          const procedureCall = (caller as any)[name]
          if (typeof procedureCall === 'function') {
            await procedureCall()
            console.info(`✅ Worker procedure ${name} completed`)
          } else {
            console.warn(`⚠️ Worker procedure ${name} is not callable`)
          }
        } catch (err) {
          console.error(`❌ Worker procedure ${name} failed`, err)
        }
      }
    }
  } catch (err) {
    console.error('❌ Error initializing worker procedures', err)
    throw err
  }
}
runWorkerProcedures().catch((err) => {
  console.error('❌ Error running worker procedures', err)
  Deno.exit(1)
})
