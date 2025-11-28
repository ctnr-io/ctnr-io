import type { ObjectMeta } from './common.ts'

/**
 * Gateway API HTTPRoute
 */
export type HTTPRoute = {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'HTTPRoute'
  metadata: ObjectMeta
  spec: {
    hostnames: string[]
    parentRefs: Array<{
      name: string
      namespace: string
      sectionName: string
    }>
    rules: HTTPRouteRule[]
  }
}

export type HTTPRouteRule = {
  matches?: Array<{
    path?: {
      type: 'Exact' | 'PathPrefix' | 'RegularExpression'
      value: string
    }
    headers?: Array<{
      type: 'Exact' | 'RegularExpression'
      name: string
      value: string
    }>
    queryParams?: Array<{
      type: 'Exact' | 'RegularExpression'
      name: string
      value: string
    }>
    method?: string
  }>
  filters?: HTTPRouteFilter[]
  backendRefs?: Array<{
    name: string
    port: number
    weight?: number
    kind?: string
    namespace?: string
  }>
}

export type HTTPRouteFilter = {
  type: string
  requestHeaderModifier?: {
    set?: Array<{ name: string; value: string }>
    add?: Array<{ name: string; value: string }>
    remove?: string[]
  }
  requestRedirect?: {
    scheme?: string
    hostname?: string
    path?: {
      type: string
      value: string
    }
    port?: number
    statusCode?: number
  }
}

/**
 * Gateway API TLSRoute
 */
export type TLSRoute = {
  apiVersion: 'gateway.networking.k8s.io/v1alpha2'
  kind: 'TLSRoute'
  metadata: ObjectMeta
  spec: {
    hostnames: string[]
    parentRefs: Array<{
      name: string
      namespace: string
      sectionName: string
    }>
    rules: Array<{
      backendRefs: Array<{
        kind: string
        name: string
        port: number
      }>
    }>
  }
}

/**
 * Gateway API Gateway
 */
export type Gateway = {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'Gateway'
  metadata: ObjectMeta
  spec: {
    gatewayClassName: string
    listeners: Array<{
      name: string
      port: number
      protocol: string
      hostname?: string
      tls?: {
        mode: string
        certificateRefs: Array<{
          name: string
          namespace?: string
          kind: string
        }>
      }
    }>
  }
}

/**
 * Gateway API ReferenceGrant
 */
export type ReferenceGrant = {
  apiVersion: 'gateway.networking.k8s.io/v1beta1'
  kind: 'ReferenceGrant'
  metadata: ObjectMeta
  spec: {
    from: Array<{
      group: string
      kind: string
      name: string
      namespace?: string
    }>
    to: Array<{
      group: string
      kind: string
      name: string
      namespace?: string
    }>
  }
}
