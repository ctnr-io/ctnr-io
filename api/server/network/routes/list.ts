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
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: z.string().optional(), // Filter by specific route name
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2']).optional(),
})

export type Input = z.infer<typeof Input>

export interface Route {
  id: string
  name: string
  path: string
  targetService: string
  targetPort: number
  domain: string
  protocol: 'http' | 'https'
  status: 'active' | 'pending' | 'error'
  created: string
  methods: string[]
}

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
  const { output = 'raw', name, cluster = 'eu' } = input

  try {
    // Get routes from HTTPRoutes and IngressRoutes (same as containers)
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]
    
    // Fetch both route types in parallel
    const [httpRoutesResult, ingressRoutesResult] = await Promise.allSettled([
      client.GatewayNetworkingV1(ctx.kube.namespace).listHTTPRoutes(),
      client.TraefikV1Alpha1(ctx.kube.namespace).listIngressRoutes(),
    ])

    const httpRoutes = httpRoutesResult.status === 'fulfilled' ? (httpRoutesResult.value as any)?.items || [] : []
    const ingressRoutes = ingressRoutesResult.status === 'fulfilled' ? (ingressRoutesResult.value as any)?.items || [] : []

    // Transform HTTPRoutes to Route format
    const httpRouteItems: Route[] = httpRoutes.map((httpRoute: any) => {
      const metadata = httpRoute.metadata || {}
      const spec = httpRoute.spec || {}
      const hostnames = spec.hostnames || []
      const rules = spec.rules || []
      
      // Get target service from first rule
      const firstRule = rules[0]
      const backendRef = firstRule?.backendRefs?.[0]
      const targetService = backendRef?.name || 'unknown'
      const targetPort = backendRef?.port || 80
      
      // Get path from first rule
      const path = firstRule?.matches?.[0]?.path?.value || '/'
      
      return {
        id: metadata.uid || metadata.name || '',
        name: metadata.name || '',
        path,
        targetService,
        targetPort,
        domain: hostnames[0] || '',
        protocol: 'https' as const,
        status: 'active' as const,
        created: String(metadata.creationTimestamp || new Date().toISOString()),
        methods: ['GET'], // HTTPRoute doesn't specify methods directly
      }
    })

    // Transform IngressRoutes to Route format
    const ingressRouteItems: Route[] = ingressRoutes.map((ingressRoute: any) => {
      const metadata = ingressRoute.metadata || {}
      const spec = ingressRoute.spec || {}
      const routes = spec.routes || []
      
      // Get target service from first route
      const firstRoute = routes[0]
      const service = firstRoute?.services?.[0]
      const targetService = service?.name || 'unknown'
      const targetPort = service?.port || 80
      
      // Extract hostname from match rule (e.g., "Host(`example.com`)")
      const match = firstRoute?.match || ''
      const hostMatch = match.match(/Host\(`([^`]+)`\)/)
      const domain = hostMatch ? hostMatch[1] : ''
      
      // Extract path from match rule
      const pathMatch = match.match(/PathPrefix\(`([^`]+)`\)/)
      const path = pathMatch ? pathMatch[1] : '/'
      
      return {
        id: metadata.uid || metadata.name || '',
        name: metadata.name || '',
        path,
        targetService,
        targetPort,
        domain,
        protocol: spec.tls ? 'https' as const : 'http' as const,
        status: 'active' as const,
        created: String(metadata.creationTimestamp || new Date().toISOString()),
        methods: ['GET'], // IngressRoute doesn't specify methods directly
      }
    })

    // Combine all routes
    let allRoutes = [...httpRouteItems, ...ingressRouteItems]

    // Filter by name if specified
    if (name) {
      allRoutes = allRoutes.filter(route => route.name === name)
    }

    const routes = allRoutes

    switch (output) {
      case 'raw':
        return routes

      case 'json':
        return JSON.stringify(routes, null, 2)

      case 'yaml':
        // Simple YAML output for routes
        return routes.map(route => 
          `name: ${route.name}\n` +
          `path: ${route.path}\n` +
          `domain: ${route.domain}\n` +
          `targetService: ${route.targetService}\n` +
          `targetPort: ${route.targetPort}\n` +
          `protocol: ${route.protocol}\n` +
          `status: ${route.status}\n` +
          `methods: [${route.methods.join(', ')}]\n---\n`
        ).join('')

      case 'name':
        return routes.map(route => route.name).join('\n')

      case 'wide':
      default:
        // Header
        yield 'NAME'.padEnd(20) +
          'PATH'.padEnd(20) +
          'DOMAIN'.padEnd(25) +
          'TARGET'.padEnd(20) +
          'PROTOCOL'.padEnd(10) +
          'STATUS'.padEnd(10) +
          'METHODS'.padEnd(15) +
          'AGE'

        // Route rows
        for (const route of routes) {
          const age = formatAge(route.created)
          const target = `${route.targetService}:${route.targetPort}`
          const methodsStr = route.methods.join(',')
          
          yield route.name.padEnd(20) +
            route.path.padEnd(20) +
            route.domain.padEnd(25) +
            target.padEnd(20) +
            route.protocol.toUpperCase().padEnd(10) +
            route.status.padEnd(10) +
            methodsStr.padEnd(15) +
            age
        }
        return
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error listing routes: ${errorMessage}`
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