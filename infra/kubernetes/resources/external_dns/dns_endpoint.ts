import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { DNSEndpoint } from 'infra/kubernetes/types/external_dns.ts'

export async function ensureDNSEndpoint(
	kc: KubeClient,
	namespace: string,
	dnsEndpoint: DNSEndpoint,
	abortSignal: AbortSignal,
): Promise<void> {
	// Ensure the dnsendpoint
	const currentDNSEndpoint = await kc.ExternalDNSV1alpha1(namespace).getDNSEndpoint(dnsEndpoint.metadata.name, {
		abortSignal,
	}).catch(
		() => null,
	)
	const nextDNSEndpoint = dnsEndpoint
	await match(
		currentDNSEndpoint,
	)
		// if dnsendpoint does not exist, create it
		.with(null, () => kc.ExternalDNSV1alpha1(namespace).createDNSEndpoint(nextDNSEndpoint as any, { abortSignal }))
		.with(nextDNSEndpoint as any, () => true)
		.otherwise(async () => {
			// else if the dnsendpoint doesn't have the same name, delete it and create a new one
			await kc.ExternalDNSV1alpha1(namespace).deleteDNSEndpoint(currentDNSEndpoint!.metadata.name, { abortSignal })
			await kc.ExternalDNSV1alpha1(namespace).createDNSEndpoint(nextDNSEndpoint as any, { abortSignal })
		})
}
