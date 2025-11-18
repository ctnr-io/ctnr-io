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
  cluster: z.enum(['karmada', 'eu-0', 'eu-1', 'eu-2']).optional(),
})

export type Input = z.infer<typeof Input>

export interface Route {
  id: string
  name: string
  domain: string
  port: number
  protocol: 'http' | 'https'
  status: 'active' | 'pending' | 'error'
  container: string
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
  const { output = 'raw', name, cluster = 'karmada' } = input

  try {
    // Get routes from HTTPRoutes and IngressRoutes (same as containers)
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]

    // Fetch both route types in parallel
    const [httpRoutesResult, ingressRoutesResult] = await Promise.allSettled([
      client.GatewayNetworkingV1(ctx.project.namespace).listHTTPRoutes(),
      client.TraefikV1Alpha1(ctx.project.namespace).listIngressRoutes(),
    ])

    const httpRoutes = httpRoutesResult.status === 'fulfilled' ? (httpRoutesResult.value as any)?.items || [] : []
    const ingressRoutes = ingressRoutesResult.status === 'fulfilled'
      ? (ingressRoutesResult.value as any)?.items || []
      : []

    // Transform HTTPRoutes to Route format
    const httpRouteItems: Route[] = httpRoutes.map((httpRoute: any) => {
      const metadata = httpRoute.metadata || {}
      const spec = httpRoute.spec || {}
      const hostnames = spec.hostnames || []
      const rules = spec.rules || []

      // Get target service from first rule
      const firstRule = rules[0]
      const backendRef = firstRule?.backendRefs?.[0]
      const container = backendRef?.name || 'unknown'
      const port = backendRef?.port || 80

      return {
        id: metadata.uid || metadata.name || '',
        name: metadata.name || '',
        domain: hostnames[0] || '',
        port,
        protocol: 'https',
        status: 'active',
        container,
        createdAt: String(metadata.creationTimestamp || new Date().toISOString()),
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
      const container = service?.name || 'unknown'
      const port = service?.port || 80

      // Extract hostname from match rule (e.g., "Host(`example.com`)")
      const match = firstRoute?.match || ''
      const hostMatch = match.match(/Host\(`([^`]+)`\)/)
      const domain = hostMatch ? hostMatch[1] : ''

      return {
        id: metadata.uid || metadata.name || '',
        name: metadata.name || '',
        domain,
        port,
        protocol: spec.tls ? 'https' : 'http',
        status: 'active',
        container,
        createdAt: String(metadata.creationTimestamp || new Date().toISOString()),
      }
    })

    // Combine all routes
    let allRoutes = [...httpRouteItems, ...ingressRouteItems]

    // Filter by name if specified
    if (name) {
      allRoutes = allRoutes.filter((route) => route.name === name)
    }

    const routes = allRoutes

    switch (output) {
      case 'raw':
        return routes

      case 'json':
        return JSON.stringify(routes, null, 2)

      case 'yaml':
        // Simple YAML output for routes
        return routes.map((route) =>
          `id: ${route.id}\n` +
          `name: ${route.name}\n` +
          `domain: ${route.domain}\n` +
          `port: ${route.port}\n` +
          `protocol: ${route.protocol}\n` +
          `status: ${route.status}\n` +
          `container: ${route.container}\n` +
        ).join('')

      case 'name':
        return routes.map((route) => route.name).join('\n')

      case 'wide':
      default:
        // Header
        yield 'ID'.padEnd(20) +
          'NAME'.padEnd(20) +
          'DOMAIN'.padEnd(25) +
          'PORT'.padEnd(8) +
          'PROTOCOL'.padEnd(10) +
          'STATUS'.padEnd(10) +
          'CONTAINER'.padEnd(20) +
          'CREATED'.padEnd(20)

        // Route rows
        for (const route of routes) {
          yield route.id.padEnd(20) +
            route.name.padEnd(20) +
            route.domain.padEnd(25) +
            String(route.port).padEnd(8) +
            route.protocol.toUpperCase().padEnd(10) +
            route.status.padEnd(10) +
            route.container.padEnd(20) +
        }
        return
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error listing routes: ${errorMessage}`
    throw error
  }
}
