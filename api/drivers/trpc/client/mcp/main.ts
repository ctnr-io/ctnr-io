import 'lib/log/mod.ts'

import process from 'node:process'
import { z } from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createTrpcClientContext } from '../context.ts'
import { authStorage } from '../terminal/storage.ts'
import { TRPCCLientTerminalRouter } from '../terminal/router.ts'
import { ClientAuthError } from 'api/drivers/errors.ts'

// login: interactive browser OAuth, attach/exec: bidirectional interactive stdin tunnels.
// None of these map onto a single-request/response MCP tool call.
const SKIPPED_PROCEDURES = new Set(['login', 'attach', 'exec'])

type ProcedureCaller = Record<string, (input?: unknown) => Promise<unknown>>

const ctx = await createTrpcClientContext({ auth: { storage: authStorage } })
const caller = TRPCCLientTerminalRouter.createCaller(ctx) as unknown as ProcedureCaller

function isZodType(value: unknown): value is z.ZodType {
  return typeof value === 'object' && value !== null && 'parse' in value &&
    typeof (value as { parse: unknown }).parse === 'function'
}

const procedureDefs = TRPCCLientTerminalRouter._def.procedures as Record<string, { _def: { inputs: unknown[] } }>

const tools = Object.entries(procedureDefs)
  .filter(([name]) => !SKIPPED_PROCEDURES.has(name))
  .map(([name, procedure]) => {
    const rawInput = procedure._def.inputs[0]
    return {
      name,
      inputSchema: isZodType(rawInput)
        ? z.toJSONSchema(rawInput, { io: 'input' }) as {
          type: 'object'
          properties?: Record<string, unknown>
          required?: string[]
        }
        : { type: 'object' as const, properties: {} },
    }
  })

const server = new Server(
  { name: 'ctnr', version: process.env.CTNR_VERSION ?? '0.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: tools.map(({ name, inputSchema }) => ({ name, inputSchema })),
}))

// Procedures call console.info directly to report progress; capture it instead of
// letting it reach stdout, which the MCP stdio transport reserves for JSON-RPC framing.
async function callWithCapturedOutput(name: string, input: unknown): Promise<{ text: string; isError: boolean }> {
  const lines: string[] = []
  const originalInfo = console.info
  console.info = (...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
  }
  try {
    const result = await caller[name](input)
    if (result !== undefined) {
      lines.push(typeof result === 'string' ? result : JSON.stringify(result))
    }
    return { text: lines.join('\n'), isError: false }
  } catch (error) {
    if (error instanceof ClientAuthError) {
      return { text: 'Not authenticated. Run `ctnr login` first.', isError: true }
    }
    const message = error instanceof Error ? error.message : String(error)
    lines.push(message)
    return { text: lines.join('\n'), isError: true }
  } finally {
    console.info = originalInfo
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request: z.infer<typeof CallToolRequestSchema>) => {
  const { name, arguments: input } = request.params
  if (!tools.some((tool) => tool.name === name)) {
    return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true }
  }
  const { text, isError } = await callWithCapturedOutput(name, input ?? {})
  return { content: [{ type: 'text' as const, text }], isError }
})

const transport = new StdioServerTransport()
await server.connect(transport)
