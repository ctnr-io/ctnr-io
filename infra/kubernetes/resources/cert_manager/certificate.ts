import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { Certificate } from 'infra/kubernetes/types/cert_manager.ts'

export async function ensureCertManagerCertificate(
	kc: KubeClient,
	namespace: string,
	certificate: Certificate,
	abortSignal: AbortSignal,
): Promise<void> {
	const currentCertificate = await kc.CertManagerV1(namespace).getCertificate(certificate.metadata.name, {
		abortSignal,
	}).catch(() => null)
	const nextCertificate = certificate
	await match(
		currentCertificate,
	)
		// if certificate does not exist, create it
		.with(null, () => kc.CertManagerV1(namespace).createCertificate(nextCertificate as any, { abortSignal }))
		// if certificate exists, and match values, do nothing,
		.with(nextCertificate as any, () => true)
		.otherwise(async () => {
			// else if the certificate doesn't have the same name, delete it and create a new one
			await kc.CertManagerV1(namespace).deleteCertificate(currentCertificate!.metadata.name, { abortSignal })
			await kc.CertManagerV1(namespace).createCertificate(nextCertificate as any, { abortSignal })
		})
}

export async function deleteCertManagerCertificate(
	kc: KubeClient,
	namespace: string,
	name: string,
	abortSignal: AbortSignal,
): Promise<void> {
	await kc.CertManagerV1(namespace).deleteCertificate(name, { abortSignal }).catch(() => {})
}