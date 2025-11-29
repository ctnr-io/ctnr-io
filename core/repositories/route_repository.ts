/**
 * Route Repository
 * Provides data access for route resources (HTTPRoute/IngressRoute)
 * 
 * Uses Karmada for write operations (propagates to member clusters)
 * Routes are read from Karmada as they're propagated resources
 */
import type { Route, RouteSummary } from 'core/entities/network/route.ts'
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'
import type { HTTPRoute } from 'core/adapters/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'core/adapters/kubernetes/types/traefik.ts'
import {
  httpRouteToRoute,
  httpRouteToSummary,
  ingressRouteToRoute,
  ingressRouteToSummary,
} from 'core/adapters/kubernetes/transform/route.ts'
import {
  ensureService,
  ensureHTTPRoute,
} from 'core/adapters/kubernetes/kube-client.ts'
import { BaseRepository, type ListOptions, type RepositoryProject, type KubeCluster } from './base_repository.ts'

export interface ListRoutesOptions extends ListOptions {
  container?: string
  domain?: string
}

export interface CreateRouteInput {
  name: string
  container: string
  hostnames: string[]
  ports: Array<{ name: string; port: number }>
}

/**
 * Repository for managing route resources
 * 
 * Write operations go through Karmada (propagates to member clusters)
 * Routes are read from Karmada (they're propagated resources, not cluster-local)
 */
export class RouteRepository extends BaseRepository<
  Route,
  RouteSummary,
  CreateRouteInput,
  ListRoutesOptions
> {
  constructor(
    kubeClient: Record<KubeCluster, KubeClient>,
    project: RepositoryProject,
  ) {
    super(kubeClient, project)
  }

  /**
   * List all routes in the namespace
   */
  async list(options: ListRoutesOptions = {}): Promise<Route[]> {
    const { name, container, domain } = options

    // Fetch both route types in parallel
    const [httpRoutes, ingressRoutes] = await Promise.all([
      this.fetchHTTPRoutes(),
      this.fetchIngressRoutes(),
    ])

    // Transform to Routes
    let routes: Route[] = [
      ...httpRoutes.map(httpRouteToRoute),
      ...ingressRoutes.map(ingressRouteToRoute),
    ]

    // Apply filters
    if (name) {
      routes = routes.filter((r) => r.name === name)
    }
    if (container) {
      routes = routes.filter((r) => r.container === container)
    }
    if (domain) {
      routes = routes.filter((r) => r.domain === domain || r.domain.includes(domain))
    }

    return routes
  }

  /**
   * List route summaries (lightweight)
   */
  async listSummaries(options: ListRoutesOptions = {}): Promise<RouteSummary[]> {
    const { name, container, domain } = options

    const [httpRoutes, ingressRoutes] = await Promise.all([
      this.fetchHTTPRoutes(),
      this.fetchIngressRoutes(),
    ])

    let summaries: RouteSummary[] = [
      ...httpRoutes.map(httpRouteToSummary),
      ...ingressRoutes.map(ingressRouteToSummary),
    ]

    if (name) {
      summaries = summaries.filter((r) => r.name === name)
    }
    if (container) {
      summaries = summaries.filter((r) => r.container === container)
    }
    if (domain) {
      summaries = summaries.filter((r) => r.domain === domain || r.domain.includes(domain))
    }

    return summaries
  }

  /**
   * Get a single route by name
   */
  async get(name: string): Promise<Route | null> {
    // Try HTTPRoute first
    const httpRoute = await this.getHTTPRoute(name)
    if (httpRoute) {
      return httpRouteToRoute(httpRoute)
    }

    // Try IngressRoute
    const ingressRoute = await this.getIngressRoute(name)
    if (ingressRoute) {
      return ingressRouteToRoute(ingressRoute)
    }

    return null
  }

  /**
   * Check if a route exists
   */
  async exists(name: string): Promise<boolean> {
    const httpRoute = await this.getHTTPRoute(name)
    if (httpRoute) return true

    const ingressRoute = await this.getIngressRoute(name)
    return ingressRoute !== null
  }

  /**
   * Create a new route (writes to Karmada)
   * Creates Service + HTTPRoute for the specified hostnames
   * For custom domain handling (verification, certificates), use the route handler
   */
  async create(input: CreateRouteInput, signal: AbortSignal = AbortSignal.timeout(30000)): Promise<Route> {
    const { name, container, hostnames, ports } = input

    // Use project's cluster for cluster labels
    const cluster = this.project.cluster
    const clustersLabels = {
      [`cluster.ctnr.io/${cluster}`]: 'true',
    }

    // 1. Create/update the Service
    await ensureService(this.karmada, this.namespace, {
      metadata: {
        name,
        namespace: this.namespace,
        labels: {
          'ctnr.io/name': container,
          ...clustersLabels,
        },
      },
      spec: {
        ports: ports.map((p) => ({
          name: p.name,
          port: p.port,
          targetPort: p.port,
        })),
        selector: {
          'ctnr.io/name': container,
        },
      },
    }, signal)

    // 2. Create/update the HTTPRoute (for *.ctnr.io hostnames)
    const ctnrHostnames = hostnames.filter((h) => h.endsWith('.ctnr.io'))
    if (ctnrHostnames.length > 0) {
      await ensureHTTPRoute(this.karmada, this.namespace, {
        apiVersion: 'gateway.networking.k8s.io/v1',
        kind: 'HTTPRoute',
        metadata: {
          name,
          namespace: this.namespace,
          labels: {
            'ctnr.io/name': container,
            ...clustersLabels,
          },
        },
        spec: {
          hostnames: ctnrHostnames,
          parentRefs: [
            {
              name: 'public-gateway',
              namespace: 'kube-public',
              sectionName: 'web',
            },
            {
              name: 'public-gateway',
              namespace: 'kube-public',
              sectionName: 'websecure',
            },
          ],
          rules: [{
            backendRefs: ports.map((port) => ({
              kind: 'Service',
              name,
              port: port.port,
            })),
          }],
        },
      }, signal)
    }

    // Return the created route
    const route = await this.get(name)
    if (!route) {
      throw new Error(`Failed to create route ${name}`)
    }
    return route
  }

  /**
   * Delete a route by name (writes to Karmada)
   */
  async delete(name: string): Promise<void> {
    // Try to delete as HTTPRoute first
    try {
      await this.karmada.GatewayNetworkingV1(this.namespace).deleteHTTPRoute(name)
      return
    } catch {
      // Not an HTTPRoute, try IngressRoute
    }

    // Try to delete as IngressRoute
    await this.karmada.TraefikV1Alpha1(this.namespace).deleteIngressRoute(name)
  }

  // Extended methods specific to routes

  /**
   * Get routes for a specific container
   */
  async getRoutesForContainer(containerName: string): Promise<Route[]> {
    return this.list({ container: containerName })
  }

  /**
   * Get route count
   */
  async count(): Promise<number> {
    const [httpRoutes, ingressRoutes] = await Promise.all([
      this.fetchHTTPRoutes(),
      this.fetchIngressRoutes(),
    ])
    return httpRoutes.length + ingressRoutes.length
  }

  // Private helper methods - routes are read from Karmada

  private async fetchHTTPRoutes(): Promise<HTTPRoute[]> {
    try {
      const result = await this.karmada.GatewayNetworkingV1(this.namespace).listHTTPRoutes()
      return (result as unknown as { items: HTTPRoute[] }).items ?? []
    } catch {
      return []
    }
  }

  private async fetchIngressRoutes(): Promise<IngressRoute[]> {
    try {
      const result = await this.karmada.TraefikV1Alpha1(this.namespace).listIngressRoutes()
      return (result as unknown as { items: IngressRoute[] }).items ?? []
    } catch {
      return []
    }
  }

  private async getHTTPRoute(name: string): Promise<HTTPRoute | null> {
    try {
      return await this.karmada.GatewayNetworkingV1(this.namespace).getHTTPRoute(name) as unknown as HTTPRoute
    } catch {
      return null
    }
  }

  private async getIngressRoute(name: string): Promise<IngressRoute | null> {
    try {
      return await this.karmada.TraefikV1Alpha1(this.namespace).getIngressRoute(name) as unknown as IngressRoute
    } catch {
      return null
    }
  }
}
