import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  name: z.string().min(1, 'Route name is required'),
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2']).optional(),
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
})

export type Input = z.infer<typeof Input>

export interface DeleteRouteResult {
  name: string
  deleted: boolean
  message: string
}

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': DeleteRouteResult
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<Output<NonNullable<typeof input['output']>>> {
  const { name, cluster = 'eu', output = 'raw' } = input

  try {
    // Delete the ConfigMap for the route
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]
    const configMapName = `route-${name}`

    // Check if route exists first
    try {
      await client.CoreV1.namespace(ctx.kube.namespace).getConfigMap(configMapName)
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Route '${name}' not found`)
      }
      throw error
    }

    // Delete the ConfigMap
    await client.CoreV1.namespace(ctx.kube.namespace).deleteConfigMap(configMapName)

    const result: DeleteRouteResult = {
      name,
      deleted: true,
      message: `Route '${name}' deleted successfully`,
    }

    yield result.message

    switch (output) {
      case 'raw':
        return result

      case 'json':
        return JSON.stringify(result, null, 2)

      case 'yaml':
        return `name: ${result.name}\n` +
          `deleted: ${result.deleted}\n` +
          `message: ${result.message}\n`

      case 'name':
        return result.name

      case 'wide':
      default: {
        // Header
        yield 'NAME'.padEnd(20) +
          'DELETED'.padEnd(10) +
          'MESSAGE'

        // Route row
        yield result.name.padEnd(20) +
          String(result.deleted).padEnd(10) +
          result.message
        return
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const result: DeleteRouteResult = {
      name,
      deleted: false,
      message: `Error deleting route: ${errorMessage}`,
    }

    yield result.message

    switch (output) {
      case 'raw':
        return result

      case 'json':
        return JSON.stringify(result, null, 2)

      case 'yaml':
        return `name: ${result.name}\n` +
          `deleted: ${result.deleted}\n` +
          `message: ${result.message}\n`

      case 'name':
        return result.name

      case 'wide':
      default: {
        // Header
        yield 'NAME'.padEnd(20) +
          'DELETED'.padEnd(10) +
          'MESSAGE'

        // Route row
        yield result.name.padEnd(20) +
          String(result.deleted).padEnd(10) +
          result.message
        return
      }
    }
  }
}