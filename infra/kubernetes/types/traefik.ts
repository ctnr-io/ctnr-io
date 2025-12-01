import type { ObjectMeta } from './common.ts'

/**
 * Traefik IngressRoute
 */
export type IngressRoute = {
  apiVersion: 'traefik.io/v1alpha1'
  kind: 'IngressRoute'
  metadata: ObjectMeta
  spec: {
    entryPoints: string[]
    routes: IngressRouteRoute[]
    tls?: IngressRouteTLS
  }
}

export type IngressRouteRoute = {
  match: string
  kind: 'Rule'
  services: Array<{
    name: string
    port: number
    weight?: number
  }>
  middlewares?: Array<{
    name: string
    namespace?: string
  }>
  priority?: number
}

export type IngressRouteTLS = {
  certResolver?: string
  domains?: Array<{
    main: string
    sans?: string[]
  }>
  secretName?: string
  options?: {
    name: string
    namespace?: string
  }
}

/**
 * Traefik Middleware
 */
export type Middleware = {
  apiVersion: 'traefik.io/v1alpha1'
  kind: 'Middleware'
  metadata: ObjectMeta
  spec: {
    // Various middleware types
    stripPrefix?: {
      prefixes: string[]
      forceSlash?: boolean
    }
    addPrefix?: {
      prefix: string
    }
    headers?: {
      customRequestHeaders?: Record<string, string>
      customResponseHeaders?: Record<string, string>
      accessControlAllowMethods?: string[]
      accessControlAllowOriginList?: string[]
      accessControlAllowHeaders?: string[]
      accessControlExposeHeaders?: string[]
      accessControlMaxAge?: number
      addVaryHeader?: boolean
    }
    rateLimit?: {
      average?: number
      burst?: number
      period?: string
      sourceCriterion?: {
        ipStrategy?: {
          depth?: number
          excludedIPs?: string[]
        }
        requestHeaderName?: string
        requestHost?: boolean
      }
    }
    basicAuth?: {
      secret: string
      realm?: string
      headerField?: string
      removeHeader?: boolean
    }
  }
}
