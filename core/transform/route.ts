/**
 * Route Transformer
 * Converts Kubernetes HTTPRoute/IngressRoute resources to Route DTOs
 */
import type { Route, RouteProtocol, RouteStatus, RouteSummary, RouteType } from 'core/schemas/network/route.ts'
import type { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'infra/kubernetes/types/traefik.ts'

/**
 * Transform a Gateway API HTTPRoute to a Route DTO
 */
export function httpRouteToRoute(httpRoute: HTTPRoute): Route {
  const metadata = httpRoute.metadata
  const spec = httpRoute.spec
  const hostnames = spec.hostnames ?? []
  const rules = spec.rules ?? []
  const labels = metadata.labels ?? {}

  // Get target service from first rule
  const firstRule = rules[0]
  const backendRef = firstRule?.backendRefs?.[0]
  const container = backendRef?.name ?? 'unknown'
  const port = backendRef?.port ?? 80

  // Extract path from first rule match
  const pathMatch = firstRule?.matches?.[0]?.path
  const path = pathMatch?.value ?? '/'

  return {
    id: metadata.uid ?? metadata.name ?? '',
    name: metadata.name ?? '',
    domain: hostnames[0] ?? '',
    path,
    container,
    port,
    backends: rules.flatMap((rule) =>
      (rule.backendRefs ?? []).map((backend) => ({
        containerName: backend.name,
        port: backend.port,
        weight: backend.weight,
      }))
    ),
    protocol: 'https' as RouteProtocol,
    status: 'active' as RouteStatus,
    createdAt: new Date(metadata.creationTimestamp ?? Date.now()),
    tls: {
      enabled: true,
    },
    type: 'HTTPRoute' as RouteType,
    cluster: labels['ctnr.io/cluster'],
    labels,
    annotations: metadata.annotations ?? {},
  }
}

/**
 * Transform a Traefik IngressRoute to a Route DTO
 */
export function ingressRouteToRoute(ingressRoute: IngressRoute): Route {
  const metadata = ingressRoute.metadata
  const spec = ingressRoute.spec
  const routes = spec.routes ?? []
  const labels = metadata.labels ?? {}

  // Get target service from first route
  const firstRoute = routes[0]
  const service = firstRoute?.services?.[0]
  const container = service?.name ?? 'unknown'
  const port = service?.port ?? 80

  // Extract hostname from match rule (e.g., "Host(`example.com`)")
  const match = firstRoute?.match ?? ''
  const hostMatch = match.match(/Host\(`([^`]+)`\)/)
  const domain = hostMatch?.[1] ?? ''

  // Extract path from match rule if present
  const pathMatch = match.match(/PathPrefix\(`([^`]+)`\)/)
  const path = pathMatch?.[1] ?? '/'

  // Determine protocol from entry points
  const entryPoints = spec.entryPoints ?? []
  const isHttps = entryPoints.includes('websecure') || entryPoints.includes('https')

  return {
    id: metadata.uid ?? metadata.name ?? '',
    name: metadata.name ?? '',
    domain,
    path,
    container,
    port,
    backends: routes.flatMap((r) =>
      (r.services ?? []).map((svc) => ({
        containerName: svc.name,
        port: svc.port,
        weight: svc.weight,
      }))
    ),
    protocol: (isHttps ? 'https' : 'http') as RouteProtocol,
    status: 'active' as RouteStatus,
    createdAt: new Date(metadata.creationTimestamp ?? Date.now()),
    tls: spec.tls
      ? {
        enabled: true,
        secretName: spec.tls.secretName,
        certResolver: spec.tls.certResolver,
      }
      : undefined,
    type: 'IngressRoute' as RouteType,
    cluster: labels['ctnr.io/cluster'],
    labels,
    annotations: metadata.annotations ?? {},
  }
}

/**
 * Transform HTTPRoute to RouteSummary
 */
export function httpRouteToSummary(httpRoute: HTTPRoute): RouteSummary {
  const metadata = httpRoute.metadata
  const spec = httpRoute.spec
  const hostnames = spec.hostnames ?? []
  const rules = spec.rules ?? []

  const firstRule = rules[0]
  const backendRef = firstRule?.backendRefs?.[0]

  return {
    id: metadata.uid ?? metadata.name ?? '',
    name: metadata.name ?? '',
    domain: hostnames[0] ?? '',
    port: backendRef?.port ?? 80,
    protocol: 'https',
    status: 'active',
    container: backendRef?.name ?? 'unknown',
  }
}

/**
 * Transform IngressRoute to RouteSummary
 */
export function ingressRouteToSummary(ingressRoute: IngressRoute): RouteSummary {
  const metadata = ingressRoute.metadata
  const spec = ingressRoute.spec
  const routes = spec.routes ?? []

  const firstRoute = routes[0]
  const service = firstRoute?.services?.[0]
  const match = firstRoute?.match ?? ''
  const hostMatch = match.match(/Host\(`([^`]+)`\)/)

  const entryPoints = spec.entryPoints ?? []
  const isHttps = entryPoints.includes('websecure') || entryPoints.includes('https')

  return {
    id: metadata.uid ?? metadata.name ?? '',
    name: metadata.name ?? '',
    domain: hostMatch?.[1] ?? '',
    port: service?.port ?? 80,
    protocol: isHttps ? 'https' : 'http',
    status: 'active',
    container: service?.name ?? 'unknown',
  }
}

/**
 * Determine route status from Kubernetes conditions/status
 */
export function determineRouteStatus(
  _conditions?: Array<{ type: string; status: string; reason?: string }>,
): RouteStatus {
  // Gateway API routes don't have status in the same way as other resources
  // In practice, we'd check parent refs acceptance status
  return 'active'
}
