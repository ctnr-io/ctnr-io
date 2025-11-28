import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { PersistentVolumeClaim } from '@cloudydeno/kubernetes-apis/core/v1'
import { match } from 'ts-pattern'

export async function ensurePersistentVolumeClaim(
	kc: KubeClient,
	namespace: string,
	pvc: PersistentVolumeClaim,
	abortSignal: AbortSignal,
): Promise<void> {
	const pvcName = pvc.metadata!.name!
	await match(
		// Get the persistent volume claim and return null if it does not exist
		await kc.CoreV1.namespace(namespace).getPersistentVolumeClaim(pvcName, { abortSignal }).catch(() => null),
	)
		// if persistent volume claim does not exist, create it
		.with(null, () => kc.CoreV1.namespace(namespace).createPersistentVolumeClaim(pvc, { abortSignal }))
		// if persistent volume claim exists, and match values, do nothing, else, patch it to ensure it match
		.with(pvc as any, () => true)
		.otherwise(async () => {
			// Delete the existing persistent volume claim first
			await kc.CoreV1.namespace(namespace).deletePersistentVolumeClaim(pvcName, { abortSignal })
			// Then create the new one
			return kc.CoreV1.namespace(namespace).createPersistentVolumeClaim(pvc, { abortSignal })
		})
}
