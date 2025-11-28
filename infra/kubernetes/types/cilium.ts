import type { ObjectMeta } from './common.ts'

/**
 * Cilium CiliumNetworkPolicy
 */
export type CiliumNetworkPolicy = {
  apiVersion: 'cilium.io/v2'
  kind: 'CiliumNetworkPolicy'
  metadata: ObjectMeta
  spec: {
    endpointSelector: {
      matchLabels: Record<string, string>
    }
    ingress?: Array<{
      fromEndpoints?: Array<{
        matchLabels: Record<string, string>
      }>
      fromEntities?: string[]
      fromCIDR?: string[]
      fromCIDRSet?: Array<{
        cidr: string
        except?: string[]
      }>
      toPorts?: Array<{
        ports: Array<{
          port: string
          protocol: 'TCP' | 'UDP' | 'ANY'
        }>
      }>
    }>
    egress?: Array<{
      toEndpoints?: Array<{
        matchLabels: Record<string, string>
      }>
      toEntities?: string[]
      toCIDR?: string[]
      toCIDRSet?: Array<{
        cidr: string
        except?: string[]
      }>
      toFQDNs?: Array<{
        matchName?: string
        matchPattern?: string
      }>
      toPorts?: Array<{
        ports: Array<{
          port: string
          protocol: 'TCP' | 'UDP' | 'ANY'
        }>
        rules?: {
          dns?: Array<{
            matchName?: string
            matchPattern?: string
          }>
        }
      }>
    }>
  }
}
