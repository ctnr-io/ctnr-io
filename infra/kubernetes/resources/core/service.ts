import { Service } from '@cloudydeno/kubernetes-apis/core/v1'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { match } from 'ts-pattern'

export async function ensureService(
	kc: KubeClient,
	namespace: string,
	service: Service,
	abortSignal: AbortSignal,
): Promise<void> {
	// Get the service and return null if it does not exist
	const currentService = await kc.CoreV1.namespace(namespace).getService(service.metadata!.name!, { abortSignal })
		.catch(() => null)
	const nextService = service
	await match(
		currentService,
	)
		// if service does not exist, create it
		.with(null, () => kc.CoreV1.namespace(namespace).createService(service, { abortSignal }))
		// if service exists, and match values, do nothing,
		.with(nextService as any, () => true)
		.otherwise(async () => {
			await kc.CoreV1.namespace(namespace).deleteService(service.metadata!.name!, { abortSignal })
			await kc.CoreV1.namespace(namespace).createService(nextService, { abortSignal })
		})
}

export async function deleteService(
	kc: KubeClient,
	namespace: string,
	name: string,
	abortSignal: AbortSignal,
): Promise<void> {
	await kc.CoreV1.namespace(namespace).deleteService(name, { abortSignal }).catch(() => null)
}