import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { ClusterPropagationPolicy } from 'infra/kubernetes/types/karmada.ts'

export async function ensureClusterPropagationPolicy(
	kc: KubeClient,
	namespace: string,
	propagationPolicy: ClusterPropagationPolicy,
	abortSignal: AbortSignal,
): Promise<void> {
	const clusterPropagationPolicyName = propagationPolicy.metadata.name
	await match(
		// Get the federated resource quota and return null if it does not exist
		await kc.KarmadaV1Alpha1(namespace).getClusterPropagationPolicy(clusterPropagationPolicyName, { abortSignal }).catch(() => null),
	)
		// if federated resource quota does not exist, create it
		.with(null, () => kc.KarmadaV1Alpha1(namespace).createClusterPropagationPolicy(propagationPolicy, { abortSignal }))
		// if federated resource quota exists, and match values, do nothing, else, patch it to ensure it match
		.with(propagationPolicy as any, () => true)
		.otherwise(async () => {
			// Delete the existing federated resource quota first
			await kc.KarmadaV1Alpha1(namespace).deleteClusterPropagationPolicy(clusterPropagationPolicyName, { abortSignal }).catch(() => null)
			// Wait a moment to ensure deletion is propagated
			await new Promise((resolve) => setTimeout(resolve, 1000))
			// Then create the new one
			return ensureClusterPropagationPolicy(kc, namespace, propagationPolicy, abortSignal)
		})
}