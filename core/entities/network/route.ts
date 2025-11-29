import { z } from 'zod'

/**
 * Route protocol
 */
export const RouteProtocol = z.enum(['http', 'https', 'tcp', 'udp', 'grpc'])
export type RouteProtocol = z.infer<typeof RouteProtocol>

/**
 * Route status
 */
export const RouteStatus = z.enum([
  'active',
  'pending',
  'error',
  'inactive',
])
export type RouteStatus = z.infer<typeof RouteStatus>

/**
 * Route type - the underlying Kubernetes resource type
 */
export const RouteType = z.enum([
  'HTTPRoute',      // Gateway API HTTPRoute
  'IngressRoute',   // Traefik IngressRoute
  'TLSRoute',       // Gateway API TLSRoute
  'TCPRoute',       // Gateway API TCPRoute
])
export type RouteType = z.infer<typeof RouteType>

/**
 * Route backend reference
 */
export const RouteBackend = z.object({
  containerName: z.string(),
  port: z.number(),
  weight: z.number().optional(),
})
export type RouteBackend = z.infer<typeof RouteBackend>

/**
 * Route path match
 */
export const RoutePathMatch = z.object({
  type: z.enum(['Exact', 'PathPrefix', 'RegularExpression']).optional().default('PathPrefix'),
  value: z.string(),
})
export type RoutePathMatch = z.infer<typeof RoutePathMatch>

/**
 * Route header match
 */
export const RouteHeaderMatch = z.object({
  name: z.string(),
  value: z.string(),
  type: z.enum(['Exact', 'RegularExpression']).optional().default('Exact'),
})
export type RouteHeaderMatch = z.infer<typeof RouteHeaderMatch>

/**
 * TLS configuration
 */
export const RouteTLS = z.object({
  enabled: z.boolean().default(true),
  secretName: z.string().optional(),
  certResolver: z.string().optional(),
})
export type RouteTLS = z.infer<typeof RouteTLS>

/**
 * Full route DTO
 */
export const Route = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  
  // Routing
  domain: z.string(),
  path: z.string().optional().default('/'),
  
  // Backend
  container: z.string(),
  port: z.number(),
  backends: z.array(RouteBackend).optional(),
  
  // Protocol
  protocol: RouteProtocol,
  
  // Status
  status: RouteStatus,
  createdAt: z.date(),
  
  // TLS
  tls: RouteTLS.optional(),
  
  // Type info
  type: RouteType.optional(),
  
  // Cluster info
  cluster: z.string().optional(),
  
  // Labels and annotations
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
})
export type Route = z.infer<typeof Route>

/**
 * Route summary for list views
 */
export const RouteSummary = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  port: z.number(),
  protocol: RouteProtocol,
  status: RouteStatus,
  container: z.string(),
})
export type RouteSummary = z.infer<typeof RouteSummary>

/**
 * Create route input
 */
export const CreateRouteInput = z.object({
  name: z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/).min(1).max(63),
  container: z.string(),
  port: z.number().min(1).max(65535),
  domain: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/).optional(),
  path: z.string().optional().default('/'),
  protocol: RouteProtocol.optional().default('https'),
  tls: z.boolean().optional().default(true),
  cluster: z.enum(['eu-0', 'eu-1', 'eu-2']).optional(),
})
export type CreateRouteInput = z.infer<typeof CreateRouteInput>
