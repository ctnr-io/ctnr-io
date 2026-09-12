import { z } from 'zod'
import { parseComposeFile } from 'core/transform/compose.ts'
import type { Stack } from 'core/schemas/compute/stack.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import type { TrpcClientContext } from 'api/drivers/trpc/client/context.ts'

export const Meta = {} as const

export const Input = z.object({
  file: z.string().meta({ positional: true }).describe('Path to a docker-compose.yaml file'),
  name: z.string().optional().describe('Stack name to use if the compose file has none'),
})
export type Input = z.infer<typeof Input>

export type Output = void

/**
 * Deploy a docker-compose.yaml stack to the cluster: parses it into a ctnr Stack, then
 * creates each service as a container (name-prefixed with the stack name), in dependency
 * order, reusing the existing single-container create/run path.
 */
export default async function* deploy(
  { ctx, input }: ClientRequest<Input, TrpcClientContext>,
): ClientResponse<Output> {
  yield `📄 Reading ${input.file}...`
  const content = await Deno.readTextFile(input.file)
  const defaultName = input.name ?? input.file.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'stack'
  const stack = parseComposeFile(content, defaultName)

  const order = sortByDependencies(stack.services)
  yield `📦 Deploying stack "${stack.name}" (${order.length} service(s)): ${order.join(', ')}`

  for (const serviceName of order) {
    const service = stack.services[serviceName]
    const containerName = `${stack.name}-${serviceName}`
    yield `🚀 Deploying ${serviceName} as ${containerName} (${service.image})...`

    await ctx.connect((server) =>
      new Promise<void>((resolve, reject) => {
        const subscription = server.core.run.subscribe(
          {
            image: service.image,
            name: containerName,
            env: service.env,
            publish: service.publish,
            volume: service.volume,
            restart: service.restart,
            detach: true,
          },
          {
            onData: (data) => {
              const message = data as { type: string; value?: unknown }
              if (message.type === 'yield') console.info(message.value)
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

  yield `✅ Deployed stack "${stack.name}"`
}

/**
 * Topologically sort a Stack's services by `depends_on` so dependencies are created first.
 */
export function sortByDependencies(services: Stack['services']): string[] {
  const order: string[] = []
  const visited = new Set<string>()

  function visit(name: string, path: Set<string>) {
    if (visited.has(name)) return
    if (path.has(name)) {
      throw new Error(`Circular dependency detected involving "${name}"`)
    }
    const nextPath = new Set(path).add(name)
    for (const dependency of services[name]?.depends_on ?? []) {
      visit(dependency, nextPath)
    }
    visited.add(name)
    order.push(name)
  }

  for (const name of Object.keys(services)) {
    visit(name, new Set())
  }

  return order
}
