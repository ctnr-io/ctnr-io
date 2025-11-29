import type { ObjectMeta } from './common.ts'

/**
 * ExternalDNS DNSEndpoint
 */
export interface DNSEndpoint {
  apiVersion: 'externaldns.k8s.io/v1alpha1'
  kind: 'DNSEndpoint'
  metadata: ObjectMeta
  spec: {
    endpoints: DNSEndpointTarget[]
  }
  status?: {
    observedGeneration?: number
  }
}

export interface DNSEndpointTarget {
  dnsName: string
  recordTTL?: number
  recordType: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS' | 'SRV'
  targets: string[]
  labels?: Record<string, string>
  providerSpecific?: Array<{
    name: string
    value: string
  }>
}

/**
 * Cilium CiliumNetworkPolicy
 */
export interface CiliumNetworkPolicy {
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
