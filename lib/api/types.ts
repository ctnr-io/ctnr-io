import { ClientContext, ServerContext, WebhookContext, WorkerContext } from 'ctx/mod.ts'
import { Deferer } from 'lib/api/defer.ts'

export type ServerRequest<Input = unknown> = { ctx: ServerContext; input: Input; signal: AbortSignal; defer: Deferer }

export type ServerResponse<Output> = AsyncGenerator<
  string,
  Output,
  unknown
>

export type WebhookRequest<Input = unknown> = { ctx: WebhookContext; input: Input; defer: Deferer }

export type WebhookResponse<Output> = AsyncGenerator<string, Output, unknown>

export type WorkerRequest<Input = unknown> = { ctx: WorkerContext; input: Input; defer: Deferer }

export type WorkerResponse<Output> = AsyncGenerator<string, Output, unknown>

export type ClientRequest<Input, Context = ClientContext> = { ctx: Context; input: Input }

export type ClientResponse<Output = void> = AsyncGenerator<
  string,
  Output,
  unknown
>
