import { DNSEndpoint } from 'infra/kubernetes/types/external_dns.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureDNSEndpoint = createEnsureResourceFunction<DNSEndpoint>({
	strategy: 'replace',
})

export const deleteDNSEndpoint = createDeleteResourceFunction<DNSEndpoint>()