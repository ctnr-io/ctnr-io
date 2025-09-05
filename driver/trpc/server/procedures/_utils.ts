import { ServerRequest, ServerResponse, WebhookRequest, WebhookResponse } from 'lib/api/types.ts'
import { ServerContext, WebhookContext } from 'ctx/mod.ts'
import { createDeferer } from 'lib/api/defer.ts'
import { MiddlewareResult } from '@trpc/server/unstable-core-do-not-import'
import { TrpcServerContext } from '../context.ts'
import { createServerContext } from 'ctx/server/mod.ts'
import { createWebhookContext } from 'ctx/webhook/mod.ts'

export type SubscribeProcedureOutput<Output> = {
  type: 'yield'
  value: string
} | {
  type: 'return'
  value?: Output
}

type TRPCServerRequest<Input> = { ctx: ServerContext; input: Input; signal: AbortSignal | undefined }

type TRPCWebhookRequest<Input> = { ctx: WebhookContext; input: Input }

export function transformSubscribeProcedure<Input, Output>(
  procedure: (opts: ServerRequest<Input>) => ServerResponse<Output>,
) {
  return async function* (
    opts: TRPCServerRequest<Input>,
  ): AsyncGenerator<SubscribeProcedureOutput<Output>, void, unknown> {
    if (!opts.signal) {
      throw new Error('AbortSignal is required')
    }
    const defer = createDeferer()
    try {
      const gen = procedure({
        ctx: opts.ctx,
        input: opts.input,
        signal: opts.signal,
        defer,
      })
      let result = await gen.next()
      while (!result.done) {
        yield { type: 'yield', value: result.value }
        result = await gen.next()
      }
      yield { type: 'return', value: result.value }
    } catch (error) {
      console.error('Error occurred while processing request', error)
      throw new Error('Failed to process request')
    } finally {
      await defer.execute()
    }
  }
}

export function transformQueryProcedure<Input, Output>(
  procedure: (opts: ServerRequest<Input>) => ServerResponse<Output>,
) {
  return async function (opts: TRPCServerRequest<Input>): Promise<Output> {
    if (!opts.signal) {
      throw new Error('AbortSignal is required')
    }
    const defer = createDeferer()
    try {
      const gen = procedure({
        ctx: opts.ctx,
        input: opts.input,
        signal: opts.signal,
        defer,
      })
      let result = await gen.next()
      while (!result.done) {
        result = await gen.next()
      }
      return result.value
    } catch (error) {
      console.error('Error occurred while processing request', error)
      throw new Error('Failed to process request')
    } finally {
      await defer.execute()
    }
  }
}

export async function withServerContext({ ctx, signal, next }: {
  ctx: TrpcServerContext
  signal?: AbortSignal
  next: (opts: {
    ctx: ServerContext
  }) => Promise<MiddlewareResult<ServerContext>>
}) {
  if (!signal) {
    throw new Error('AbortSignal is required')
  }
  try {
    return next({ ctx: await createServerContext(ctx, signal) })
  } catch (error) {
    console.error('Error creating server context:', error)
    throw error
  }
}

export async function withWebhookContext({ ctx, next }: {
  ctx: TrpcServerContext
  next: (opts: {
    ctx: WebhookContext
  }) => Promise<MiddlewareResult<WebhookContext>>
}) {
  try {
    return next({ ctx: await createWebhookContext(ctx) })
  } catch (error) {
    console.error('Error creating webhook context:', error)
    throw error
  }
}

export function transformWebhookRequest<Input, Output>(
  procedure: (opts: WebhookRequest<Input>) => WebhookResponse<Output>,
) {
  return async function (opts: TRPCWebhookRequest<Input>): Promise<Output> {
    const defer = createDeferer()
    try {
      const gen = procedure({
        ctx: opts.ctx,
        input: opts.input,
        defer,
      })
      let result = await gen.next()
      while (!result.done) {
        result = await gen.next()
      }
      return result.value
    } finally {
      await defer.execute()
    }
  }
}
