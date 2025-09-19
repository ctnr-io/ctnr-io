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
  path: z.string().min(1, 'Route path is required'),
  targetService: z.string().min(1, 'Target service is required'),
  targetPort: z.number().min(1).max(65535),
  domain: z.string().min(1, 'Domain is required'),
  protocol: z.enum(['http', 'https']).default('https'),
  methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])).default(['GET']),
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2']).optional(),
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
})

export type Input = z.infer<typeof Input>

export interface CreateRouteResult {
  id: string
  name: string
  path: string
  targetService: string
  targetPort: number
  domain: string
  protocol: 'http' | 'https'
  status: 'pending'
  created: string
  methods: string[]
}

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': CreateRouteResult
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<Output<NonNullable<typeof input['output']>>> {
  const { 
    name, 
    path, 
    targetService, 
    targetPort, 
    domain, 
    protocol = 'https', 
    methods = ['GET'],
    cluster = 'eu',
    output = 'raw'
  } = input

  try {
    // Validate route name format
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('Route name must contain only lowercase letters, numbers, and hyphens')
    }

    // Create ConfigMap for route configuration
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]
    
    // Check if route already exists
    try {
      await client.CoreV1.namespace(ctx.kube.namespace).getConfigMap(`route-${name}`)
      throw new Error(`Route '${name}' already exists`)
    } catch (error: any) {
      if (error.status !== 404) {
        throw error
      }
      // Route doesn't exist, proceed with creation
    }

    const configMapName = `route-${name}`
    const configMapData = {
      name,
      path,
      targetService,
      targetPort: String(targetPort),
      domain,
      protocol,
      methods: methods.join(','),
      status: 'pending',
    }

    const configMap = {
      apiVersion: 'v1' as const,
      kind: 'ConfigMap' as const,
      metadata: {
        name: configMapName,
        namespace: ctx.kube.namespace,
        labels: {
          'ctnr.io/resource-type': 'route',
          'ctnr.io/route-name': name,
          'ctnr.io/domain': domain,
        },
        annotations: {
          'ctnr.io/created-by': 'ctnr-io-api',
          'ctnr.io/created-at': new Date().toISOString(),
        },
      },
      data: configMapData,
    }

    const createdConfigMap = await client.CoreV1.namespace(ctx.kube.namespace).createConfigMap(configMap)

    const result: CreateRouteResult = {
      id: createdConfigMap.metadata?.uid || '',
      name,
      path,
      targetService,
      targetPort,
      domain,
      protocol,
      status: 'pending',
      created: String(createdConfigMap.metadata?.creationTimestamp || new Date().toISOString()),
      methods,
    }

    yield `Route '${name}' created successfully`

    switch (output) {
      case 'raw':
        return result

      case 'json':
        return JSON.stringify(result, null, 2)

      case 'yaml':
        return `name: ${result.name}\n` +
          `path: ${result.path}\n` +
          `domain: ${result.domain}\n` +
          `targetService: ${result.targetService}\n` +
          `targetPort: ${result.targetPort}\n` +
          `protocol: ${result.protocol}\n` +
          `status: ${result.status}\n` +
          `methods: [${result.methods.join(', ')}]\n` +
          `created: ${result.created}\n`

      case 'name':
        return result.name

      case 'wide':
      default: {
        // Header
        yield 'NAME'.padEnd(20) +
          'PATH'.padEnd(20) +
          'DOMAIN'.padEnd(25) +
          'TARGET'.padEnd(20) +
          'PROTOCOL'.padEnd(10) +
          'STATUS'.padEnd(10) +
          'METHODS'.padEnd(15) +
          'AGE'

        // Route row
        const age = formatAge(result.created)
        const target = `${result.targetService}:${result.targetPort}`
        const methodsStr = result.methods.join(',')
        
        yield result.name.padEnd(20) +
          result.path.padEnd(20) +
          result.domain.padEnd(25) +
          target.padEnd(20) +
          result.protocol.toUpperCase().padEnd(10) +
          result.status.padEnd(10) +
          methodsStr.padEnd(15) +
          age
        return
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error creating route: ${errorMessage}`
    throw error
  }
}

function formatAge(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}