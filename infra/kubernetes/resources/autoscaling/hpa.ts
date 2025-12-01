import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { HorizontalPodAutoscaler } from 'infra/kubernetes/types/autoscaling.ts'

export async function ensureHorizontalPodAutoscaler(
	kc: KubeClient,
	namespace: string,
	hpa: HorizontalPodAutoscaler,
	abortSignal: AbortSignal,
): Promise<void> {
	const hpaName = hpa.metadata.name
	await match(
		// Get the horizontal pod autoscaler and return null if it does not exist
		await kc.AutoScalingV2Api.namespace(namespace).getHorizontalPodAutoscaler(hpaName, { abortSignal }).catch(
			() => null,
		),
	)
		// if horizontal pod autoscaler does not exist, create it
		.with(
			null,
			() => kc.AutoScalingV2Api.namespace(namespace).createHorizontalPodAutoscaler(hpa, { abortSignal }),
		)
		// if horizontal pod autoscaler exists, and match values, do nothing, else, patch it to ensure it match
		.with(hpa as any, () => true)
		.otherwise(async () => {
			console.debug('Replacing existing HorizontalPodAutoscaler', hpaName)
			// Delete the existing horizontal pod autoscaler first
			await kc.AutoScalingV2Api.namespace(namespace).deleteHorizontalPodAutoscaler(hpaName, { abortSignal })
			// Then create the new one
			return kc.AutoScalingV2Api.namespace(namespace).createHorizontalPodAutoscaler(hpa, { abortSignal })
		})
}