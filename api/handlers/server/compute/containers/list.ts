import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import * as YAML from '@std/yaml'
import { type ContainerContext, listContainers } from 'core/data/compute/container.ts'
import { formatAge } from 'lib/api/formatter.ts'
import { bold, colorStatus } from 'lib/api/colors.ts'
import type { Container } from 'core/schemas/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
      all: 'a',
      quiet: 'q',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: ContainerName.optional(),
  all: z.boolean().optional().describe(
    'Show all containers (default hides stopped containers)',
  ),
  quiet: z.boolean().optional().describe('Only display container names'),
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

export default async function* listContainersApiHandler<T extends OutputType = 'raw'>(
  request: ServerRequest<Input<T>>,
): ServerResponse<Output<T>> {
  const { ctx, input } = request
  const { output = 'raw', name, all, quiet, fields = ['basic'] } = input

  // Determine which fields to fetch
  const requestedFields = new Set(fields)
  const fetchAll = requestedFields.has('all')

  // Create container context
  const containerCtx: ContainerContext = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
  }

  // Fetch containers using core/data
  const fetchedContainers = await listContainers(containerCtx, {
    name,
    includeMetrics: fetchAll || requestedFields.has('metrics'),
    includeRoutes: fetchAll || requestedFields.has('routes'),
    includePods: fetchAll || requestedFields.has('replicas'),
  })

  // Docker-style default: hide stopped containers unless --all is passed.
  // A specific --name lookup (used by `get`/`inspect`) always returns its match
  // regardless of status, matching `docker inspect`.
  const containers = (all || name) ? fetchedContainers : fetchedContainers.filter((c) => c.status !== 'stopped')

  // --quiet forces the name-only output, like `docker ps -q`.
  const effectiveOutput = quiet ? 'name' : output

  // Handle output formats
  switch (effectiveOutput) {
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
      yield bold(
        'NAME'.padEnd(26) +
          'IMAGE'.padEnd(25) +
          'STATUS'.padEnd(15) +
          'REPLICAS'.padEnd(12) +
          'CPU'.padEnd(8) +
          'MEMORY'.padEnd(10) +
          'AGE'.padEnd(12) +
          'PORTS'.padEnd(20),
      )

      // Container rows
      for (const container of containers) {
        const name = container.name.padEnd(26)
        const image = (container.image || '').substring(0, 24).padEnd(25)
        // Pad the plain text first, then color the padded string: the ANSI codes add
        // invisible characters, so coloring after padding keeps columns aligned.
        const status = colorStatus(container.status.padEnd(15))
        const replicas = `${container.replicas?.current ?? 0}`.padEnd(12)
        const cpu = (container.resources?.requests?.cpu || '').padEnd(8)
        const memory = (container.resources?.requests?.memory || '').padEnd(10)
        const age = formatAge(container.createdAt).padEnd(12)
        const ports = (container.ports?.map((p) => `${p.name || p.number}:${p.number}/${p.protocol}`).join(', ') || '')
          .padEnd(20)

        yield name + image + status + replicas + cpu + memory + age + ports
      }
      return (void 0) as Output<T>
  }
}
