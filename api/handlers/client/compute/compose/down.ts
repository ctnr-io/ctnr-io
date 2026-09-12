import { z } from 'zod'
import { parseComposeFile } from 'core/transform/compose.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import type { TrpcClientContext } from 'api/drivers/trpc/client/context.ts'
import { sortByDependencies } from './up.ts'
import { step } from 'lib/api/progress.ts'

export const Meta = {} as const

export const Input = z.object({
  file: z.string().meta({ positional: true }).describe('Path to a docker-compose.yaml file'),
  name: z.string().optional().describe('Stack name to use if the compose file has none'),
})
export type Input = z.infer<typeof Input>

export type Output = void

/**
 * Tear down a docker-compose.yaml stack from the cluster: parses it into a ctnr Stack, then
 * removes each service's container (name-prefixed with the stack name), in reverse dependency
 * order, reusing the existing single-container remove path.
 */
export default async function* down(
  { ctx, input }: ClientRequest<Input, TrpcClientContext>,
): ClientResponse<Output> {
  yield `📄 Reading ${input.file}...`
  const content = await Deno.readTextFile(input.file)
  const defaultName = input.name ?? input.file.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'stack'
  const stack = parseComposeFile(content, defaultName)

  const order = sortByDependencies(stack.services).reverse()
  yield `📦 Tearing down stack "${stack.name}" (${order.length} service(s)): ${order.join(', ')}`

  for (const serviceName of order) {
    const containerName = `${stack.name}-${serviceName}`
    yield `🗑️  Removing ${serviceName} (${containerName})...`

    await ctx.connect((server) =>
      new Promise<void>((resolve, reject) => {
        const subscription = server.core.remove.subscribe(
          {
            name: containerName,
            force: true,
          },
          {
            onData: (data) => {
              const message = data as { type: string; value?: unknown }
              if (message.type === 'yield' && typeof message.value === 'string') step(message.value)
            },
            onError: reject,
            onComplete: () => {
              subscription.unsubscribe()
              resolve()
            },
          },
        )
      })
    )
  }

  yield `✅ Tore down stack "${stack.name}"`
}
