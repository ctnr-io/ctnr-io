import type { KubeClient } from 'infra/kubernetes/mod.ts'
import { ensureHTTPRoute } from 'infra/kubernetes/resources/gateway/http_route.ts'
import { ensureService } from 'infra/kubernetes/resources/core/service.ts'
import { httpRouteToRoute, ingressRouteToRoute } from 'core/transform/route.ts'
import type { Route } from 'core/schemas/network/route.ts'
import type { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'infra/kubernetes/types/traefik.ts'

export interface EnsureRouteInput {
  name: string
  container: string
  hostnames: string[]
  ports: Array<{ name: string; port: number }>
  namespace: string
}

/**
 * Ensure a route exists (Service + HTTPRoute)
 */
export async function ensureRoute(
  kubeClient: KubeClient,
  input: EnsureRouteInput,
  signal: AbortSignal
): Promise<void> {
  const { namespace } = input
  const { name, container, hostnames, ports } = input

  // 1. Ensure Service
  await ensureService(kubeClient, namespace, {
    metadata: {
      name,
      namespace,
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

  // 2. Ensure HTTPRoute for ctnr.io hostnames
  const ctnrHostnames = hostnames.filter((h) => h.endsWith('.ctnr.io'))
  if (ctnrHostnames.length > 0) {
    await ensureHTTPRoute(kubeClient, namespace, {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name,
        namespace,
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
}

/**
 * Delete a route (HTTPRoute or IngressRoute)
 */
export async function deleteRoute(
  kubeClient: KubeClient,
  namespace: string,
  name: string
): Promise<void> {
  // Try to delete as HTTPRoute first
  try {
    await kubeClient.GatewayNetworkingV1(namespace).deleteHTTPRoute(name)
    return
  } catch {
    // Not an HTTPRoute, try IngressRoute
  }

  // Try to delete as IngressRoute
  await kubeClient.TraefikV1Alpha1(namespace).deleteIngressRoute(name)
}

/**
 * Check if a route exists
 */
export async function routeExists(
  kubeClient: KubeClient,
  namespace: string,
  name: string
): Promise<boolean> {
  try {
    await kubeClient.GatewayNetworkingV1(namespace).getHTTPRoute(name)
    return true
  } catch {
    // Not an HTTPRoute, try IngressRoute
  }

  try {
    await kubeClient.TraefikV1Alpha1(namespace).getIngressRoute(name)
    return true
  } catch {
    return false
  }
}

export interface ListRoutesOptions {
  name?: string
  container?: string
  domain?: string
  signal?: AbortSignal
}

/**
 * List all routes in the namespace
 */
export async function listRoutes(
  kubeClient: KubeClient,
  namespace: string,
  options: ListRoutesOptions = {}
): Promise<Route[]> {
  const { name, container, domain, signal } = options

  const routes: Route[] = []

  // Fetch HTTPRoutes
  try {
    // deno-lint-ignore no-explicit-any
    const httpRoutesResponse: any = await kubeClient.GatewayNetworkingV1(namespace).listHTTPRoutes({ abortSignal: signal })
    const httpRoutes = (httpRoutesResponse.items ?? []) as HTTPRoute[]
    
    for (const httpRoute of httpRoutes) {
      const route = httpRouteToRoute(httpRoute)
      
      // Apply filters
      if (name && route.name !== name) continue
      if (container && route.container !== container) continue
      if (domain && !route.domain.includes(domain)) continue
      
      routes.push(route)
    }
  } catch {
    // HTTPRoutes not available
  }

  // Fetch IngressRoutes
  try {
    const ingressRoutesResponse = await kubeClient.TraefikV1Alpha1(namespace).listIngressRoutes({ abortSignal: signal })
    const ingressRoutes = (ingressRoutesResponse.items ?? []) as IngressRoute[]
    
    for (const ingressRoute of ingressRoutes) {
      const route = ingressRouteToRoute(ingressRoute)
      
      // Apply filters
      if (name && route.name !== name) continue
      if (container && route.container !== container) continue
      if (domain && !route.domain.includes(domain)) continue
      
      routes.push(route)
    }
  } catch {
    // IngressRoutes not available
  }

  return routes
}
