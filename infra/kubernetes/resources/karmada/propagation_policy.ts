import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { PropagationPolicy } from 'infra/kubernetes/types/karmada.ts'

export async function ensurePropagationPolicy(
	kc: KubeClient,
	namespace: string,
	propagationPolicy: PropagationPolicy,
	abortSignal: AbortSignal,
): Promise<void> {
	const propagationPolicyName = propagationPolicy.metadata.name
	await match(
		// Get the federated resource quota and return null if it does not exist
		await kc.KarmadaV1Alpha1(namespace).getPropagationPolicy(propagationPolicyName, { abortSignal }).catch(() => null),
	)
		// if federated resource quota does not exist, create it
		.with(null, () => kc.KarmadaV1Alpha1(namespace).createPropagationPolicy(propagationPolicy, { abortSignal }))
		// if federated resource quota exists, and match values, do nothing, else, patch it to ensure it match
		.with(propagationPolicy as any, () => true)
		.otherwise(async () => {
			// Delete the existing federated resource quota first
			await kc.KarmadaV1Alpha1(namespace).deletePropagationPolicy(propagationPolicyName, { abortSignal })
			// Wait a moment to ensure deletion is propagated
			await new Promise((resolve) => setTimeout(resolve, 1000))
			// Then create the new one
			return ensurePropagationPolicy(kc, namespace, propagationPolicy, abortSignal)
		})
}
