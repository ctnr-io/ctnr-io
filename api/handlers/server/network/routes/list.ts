import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as YAML from '@std/yaml'
import { listRoutes } from 'core/data/network/route.ts'
import { formatAge } from 'lib/api/formatter.ts'
import type { Route } from 'core/schemas/network/route.ts'

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
  container: z.string().optional(),
  domain: z.string().optional(),
})

export type Input = z.infer<typeof Input>

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': Route[]
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<Output<NonNullable<typeof input['output']>>> {
  const { output = 'raw', name, container, domain } = input

  const kubeClient = ctx.kube.client['karmada']

  // Fetch routes using core/data
  const routes = await listRoutes(kubeClient, ctx.project.namespace, { name, container, domain })

  switch (output) {
    case 'raw':
      return routes

    case 'json':
      return JSON.stringify(routes, null, 2)

    case 'yaml':
      return YAML.stringify(routes)

    case 'name':
      return routes.map((route) => route.name).join('\n')

    case 'wide':
    default:
      // Header
      yield 'NAME'.padEnd(20) +
        'DOMAIN'.padEnd(30) +
        'PORT'.padEnd(8) +
        'PROTOCOL'.padEnd(10) +
        'STATUS'.padEnd(10) +
        'CONTAINER'.padEnd(20) +
        'AGE'

      // Route rows
      for (const route of routes) {
        yield route.name.padEnd(20) +
          route.domain.padEnd(30) +
          String(route.port).padEnd(8) +
          route.protocol.toUpperCase().padEnd(10) +
          route.status.padEnd(10) +
          route.container.padEnd(20) +
          formatAge(route.createdAt)
      }
      return
  }
}
