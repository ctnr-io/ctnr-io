import { WebhookRequest, WebhookResponse } from 'lib/api/types.ts'
import z from 'zod'

export const Meta = {
	openapi: { method: 'GET', path: '/version' },
} as const

export const Input = z.object()

export type Input = z.infer<typeof Input>

export type Output = string
// TODO: finish and test it
export default async function* getVersion(request: WebhookRequest<Input>): WebhookResponse<Output> {
	return request.ctx.version
}