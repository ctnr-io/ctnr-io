import { ensureCertManagerCertificate, ensureIngressRoute, type KubeClient } from 'infra/kubernetes/mod.ts'
import { ensureHTTPRoute } from 'infra/kubernetes/resources/gateway/http_route.ts'
import { ensureService } from 'infra/kubernetes/resources/core/service.ts'
import { httpRouteToRoute, ingressRouteToRoute } from 'core/transform/route.ts'
import type { Route } from 'core/schemas/network/route.ts'
import type { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'infra/kubernetes/types/traefik.ts'
import { getContainer } from '../compute/container.ts'
import { isDomainVerified } from './domain.ts'
import { ClusterName } from '../../schemas/common.ts'
import { normalizePath } from 'trpc-to-openapi'

export interface EnsureRouteInput {
  name: string
  container: string
  hostname: string
  path: string
  protocol: 'http' | 'https'
  ports: Array<{ name: string; port: number }>
  namespace: string
  project: { id: string; cluster: ClusterName }
}

/**
 * Ensure a route exists (Service + HTTPRoute)
 */
export async function ensureRoute(
  kubeClient: KubeClient,
  input: EnsureRouteInput,
  signal: AbortSignal,
): Promise<void> {
  const { namespace } = input
  const { name, container: containerName, hostname, ports, project, path = '/', protocol } = input

  // 0. Retrieve containers published ports
  const container = await getContainer(
    { kubeClient, namespace },
    input.container,
    { signal },
  )
  if (!container) {
    throw new Error(`Container ${input.container} not found in namespace ${namespace}`)
  }

  console.log(`Ensuring route ${name} for container ${containerName} on hostname ${hostname}`)

  // 1. Ensure Service
  await ensureService(kubeClient, namespace, {
    metadata: {
      name: input.container,
      namespace,
    },
    spec: {
      ports: container.ports.map((p) => ({
        name: p.name,
        port: p.number,
        targetPort: p.number,
      })),
      selector: {
        'ctnr.io/name': containerName,
      },
    },
  }, signal)

  const normalizedPath = normalizePath(path)

  // 2. Ensure HTTPRoute for ctnr.io hostnames
  if (hostname.endsWith('.ctnr.io')) {
    await ensureHTTPRoute(kubeClient, namespace, {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name,
        namespace,
      },
      spec: {
        hostnames: [hostname],
        parentRefs: [
          // Map protocol to correct gateway listener sectionName
          // https => websecure, http => web
          protocol === 'https'
            ? {
              name: 'public-gateway',
              namespace: 'kube-public',
              sectionName: 'websecure',
            }
            : {
              name: 'public-gateway',
              namespace: 'kube-public',
              sectionName: 'web',
            },
        ],
        rules: [{
          backendRefs: ports.map((port) => ({
            kind: 'Service',
            name: input.container,
            port: port.port,
          })),
          matches: [{
            path: {
              value: normalizedPath,
              type: 'PathPrefix',
            }
          }],
        }],
      },
    }, signal)
  }

  // 3. Ensure IngressRoute for custom domain hostnames
  if (!hostname.endsWith('.ctnr.io')) {
    // get domain

    // Check if domain is verified
    if (!await isDomainVerified(hostname, project.id)) {
      throw new Error(`Domain ${hostname} is not verified`)
    }

  await ensureIngressRoute(kubeClient, namespace, {
      apiVersion: 'traefik.io/v1alpha1',
      kind: 'IngressRoute',
      metadata: {
        name,
        namespace,
      },
      spec: {
        entryPoints: [protocol === 'https' ? 'websecure' : 'web'],
        routes: [{
          match: `Host(\`${hostname}\`) && PathPrefix(\`${normalizedPath}\`)`,
          kind: 'Rule',
          services: ports.map((port) => ({
            name: input.container,
            port: port.port,
          })),
        }],
        tls: {
          secretName: `${name}-tls`,
        },
      },
    }, signal)

    if (protocol === 'https') {
      await ensureCertManagerCertificate(kubeClient, namespace, {
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        metadata: {
          name: name,
          namespace,
        },
        spec: {
          dnsNames: [hostname],
          secretName: `${name}-tls`,
          issuerRef: {
            name: 'letsencrypt',
            kind: 'ClusterIssuer',
          },
        },
      }, signal)
    }
  }
}

/**
 * Delete a route (HTTPRoute or IngressRoute)
 */
export async function deleteRoute(
  kubeClient: KubeClient,
  namespace: string,
  name: string,
): Promise<void> {
  const route = await listRoutes(kubeClient, namespace, { name })
  if (route.length === 0) {
    throw new Error(`Route ${name} not found in namespace ${namespace}`)
  }

  // Try to delete as HTTPRoute first
  try {
    await kubeClient.GatewayNetworkingV1(namespace).deleteHTTPRoute(name)
    return
  } catch {
    // Not an HTTPRoute, try IngressRoute
  }

  // Try to delete as IngressRoute
  await kubeClient.TraefikV1Alpha1(namespace).deleteIngressRoute(name)

  // Check if there is any route and delete the service if not
  const routes = await listRoutes(kubeClient, namespace, { name })
  if (routes.length === 0) {
    await kubeClient.CoreV1.namespace(namespace).deleteService(route[0].container)
  }
}

/**
 * Check if a route exists
 */
export async function routeExists(
  kubeClient: KubeClient,
  namespace: string,
  name: string,
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
  options: ListRoutesOptions = {},
): Promise<Route[]> {
  const { name, container, domain, signal } = options

  const routes: Route[] = []

  // Fetch HTTPRoutes
  try {
    // deno-lint-ignore no-explicit-any
    const httpRoutesResponse: any = await kubeClient.GatewayNetworkingV1(namespace).listHTTPRoutes({
      abortSignal: signal,
    })
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
