import { ClientContext, ServerContext, WebhookContext, WorkerContext } from 'api/context/mod.ts'
import { Deferer } from 'lib/api/defer.ts'

export type TerminalLoadMessage = {
  type: 'load'
  value?: string
}

export type TerminalOutputMessage = string | TerminalLoadMessage

export type ServerRequest<Input = unknown, Context = ServerContext> = { ctx: Context; input: Input; abortSignal: AbortSignal; defer: Deferer }

export type ServerResponse<Output> = AsyncGenerator<
  TerminalOutputMessage,
  Output,
  unknown
>

export type WebhookRequest<Input = unknown> = { ctx: WebhookContext; input: Input; defer: Deferer }

export type WebhookResponse<Output> = AsyncGenerator<TerminalOutputMessage, Output, unknown>

export type WorkerRequest<Input = unknown> = { ctx: WorkerContext; input: Input; defer: Deferer }

export type WorkerResponse<Output> = AsyncGenerator<TerminalOutputMessage, Output, unknown>

export type ClientRequest<Input, Context = ClientContext> = { ctx: Context; input: Input }

export type ClientResponse<Output = void> = AsyncGenerator<
  TerminalOutputMessage,
  Output,
  unknown
>

export function isTerminalLoadMessage(value: TerminalOutputMessage): value is TerminalLoadMessage {
  return typeof value === 'object' && value !== null && value.type === 'load'
}
