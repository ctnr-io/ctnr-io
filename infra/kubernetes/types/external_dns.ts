import { ObjectMeta } from './common.ts'

/**
 * ExternalDNS DNSEndpoint
 */
export type DNSEndpoint = {
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

export type DNSEndpointTarget = {
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
