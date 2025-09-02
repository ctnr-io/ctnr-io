import { ClientContext, ServerContext, WebhookContext } from 'ctx/mod.ts'
import { Deferer } from 'lib/api/defer.ts'

export type ServerRequest<Input = unknown> = { ctx: ServerContext; input: Input; signal: AbortSignal; defer: Deferer }

export type ServerResponse<Output> = AsyncGenerator<
  string,
  Output,
  unknown
>

export type WebhookRequest<Input = unknown> = { ctx: WebhookContext; input: Input; defer: Deferer }

export type WebhookResponse<Output> = AsyncGenerator<string, Output, unknown>

export type ClientRequest<Input> = { ctx: ClientContext; input: Input }

export type ClientResponse<Output = void> = AsyncGenerator<
  string,
  Output,
  unknown
>
