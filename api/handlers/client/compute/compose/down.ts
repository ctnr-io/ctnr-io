import { z } from 'zod'
import { parseComposeFile } from 'core/transform/compose.ts'
import { ClientRequest, ClientResponse } from 'lib/api/types.ts'
import type { TrpcClientContext } from 'api/drivers/trpc/client/context.ts'
import { step } from 'lib/api/progress.ts'
import type { Container } from 'core/schemas/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
      'volumes': 'v',
    },
  },
}

export const Input = z.object({
  file: z.string().meta({ positional: true }).describe('Path to a docker-compose.yaml file'),
  name: z.string().optional().describe('Stack name to use if the compose file has none'),
  volumes: z.boolean().optional().describe("Also delete each service's volumes"),
})
export type Input = z.infer<typeof Input>

export type Output = void

/**
 * Tear down a docker-compose.yaml stack from the cluster: parses the local file only to
 * recover the stack name and each service's declared volumes, then queries the cluster by
 * `ctnr.io/stack` label for the actual deployed containers (so teardown doesn't depend on the
 * local file matching what was actually deployed) and removes each one. With `volumes`, also
 * reclaims each service's volumes via the existing volume-delete path.
 */
export default async function* down(
  { ctx, input }: ClientRequest<Input, TrpcClientContext>,
): ClientResponse<Output> {
  yield `📄 Reading ${input.file}...`
  const content = await Deno.readTextFile(input.file)
  const defaultName = input.name ?? input.file.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'stack'
  const stack = parseComposeFile(content, defaultName)

  yield `🔍 Looking up stack "${stack.name}" containers...`
  const containers = await ctx.connect((server) =>
    new Promise<Container[]>((resolve, reject) => {
      const subscription = server.core.list.subscribe(
        { stack: stack.name, output: 'raw' },
        {
          onData: (data) => {
            const message = data as { type: string; value?: unknown }
            if (message.type === 'return') resolve((message.value ?? []) as Container[])
          },
          onError: reject,
          onComplete: () => subscription.unsubscribe(),
        },
      )
    })
  )

  yield `📦 Tearing down stack "${stack.name}" (${containers.length} service(s)): ${
    containers.map((c) => c.labels?.['ctnr.io/stack-service'] ?? c.name).join(', ')
  }`

  const deletedVolumes = new Set<string>()

  for (const container of containers) {
    const containerName = container.name
    const serviceName = container.labels?.['ctnr.io/stack-service']
    yield `🗑️  Removing ${serviceName ?? containerName} (${containerName})...`

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

    if (!input.volumes) continue
    // Volume names come from the local compose file, keyed by service name: a container missing
    // its stack-service label (deployed before this change) has no volumes to look up here.
    if (!serviceName) continue

    for (const mount of stack.services[serviceName]?.volume ?? []) {
      const volumeName = mount.split(':')[0]
      if (deletedVolumes.has(volumeName)) continue
      deletedVolumes.add(volumeName)

      yield `🗑️  Deleting volume ${volumeName}...`
      await ctx.connect((server) =>
        new Promise<void>((resolve, reject) => {
          // force: true - the just-removed container's pod may still be terminating and referencing this PVC.
          const subscription = server.storage.volumes.delete.subscribe(
            { name: volumeName, force: true },
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
  }

  yield `✅ Tore down stack "${stack.name}"`
}
