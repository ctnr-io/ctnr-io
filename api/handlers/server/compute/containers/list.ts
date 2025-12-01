import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as YAML from '@std/yaml'
import { listContainers, type ContainerContext } from 'core/data/compute/container.ts'
import { formatAge } from 'lib/api/formatter.ts'
import type { Container } from 'core/schemas/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: z.string().optional(),
  fields: z.array(z.enum([
    'basic',
    'resources',
    'replicas',
    'routes',
    'clusters',
    'config',
    'metrics',
    'all',
  ])).optional(),
})

type OutputType = NonNullable<z.infer<typeof Input>['output']>

export type Input<T extends OutputType> = z.infer<typeof Input> & {
  output?: T
}

export type Output<T extends OutputType> = {
  'raw': Container[]
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[T]

// Keep ContainerData for backward compatibility
export type ContainerData = Container

export default async function* listContainer<T extends OutputType = 'raw'>(
  request: ServerRequest<Input<T>>,
): ServerResponse<Output<T>> {
  const { ctx, input } = request
  const { output = 'raw', name, fields = ['basic'] } = input

  // Determine which fields to fetch
  const requestedFields = new Set(fields)
  const fetchAll = requestedFields.has('all')

  // Create container context
  const containerCtx: ContainerContext = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
  }

  // Fetch containers using core/data
  const containers = await listContainers(containerCtx, {
    name,
    includeMetrics: fetchAll || requestedFields.has('metrics'),
    includeRoutes: fetchAll || requestedFields.has('routes'),
    includePods: fetchAll || requestedFields.has('replicas'),
  })

  // Handle output formats
  switch (output) {
    case 'name':
      return containers.map((c) => c.name).join('\n') as Output<T>

    case 'raw':
      return containers as Output<T>

    case 'json':
      return JSON.stringify(containers, null, 2) as Output<T>

    case 'yaml':
      return YAML.stringify(containers) as Output<T>

    case 'wide':
    default:
      // Header
      yield 'NAME'.padEnd(26) +
        'IMAGE'.padEnd(25) +
        'STATUS'.padEnd(15) +
        'REPLICAS'.padEnd(12) +
        'CPU'.padEnd(8) +
        'MEMORY'.padEnd(10) +
        'AGE'.padEnd(12) +
        'PORTS'.padEnd(20)

      // Container rows
      for (const container of containers) {
        const name = container.name.padEnd(26)
        const image = (container.image || '').substring(0, 24).padEnd(25)
        const status = container.status.padEnd(15)
        const replicas = `${container.replicas?.current ?? 0}`.padEnd(12)
        const cpu = (container.resources?.requests?.cpu || '').padEnd(8)
        const memory = (container.resources?.requests?.memory || '').padEnd(10)
        const age = formatAge(container.createdAt).padEnd(12)
        const ports = (container.ports?.map((p) => `${p.name || p.number}:${p.number}/${p.protocol}`).join(', ') || '').padEnd(20)

        yield name + image + status + replicas + cpu + memory + age + ports
      }
      return (void 0) as Output<T>
  }
}
