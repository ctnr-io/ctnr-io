import { match } from 'ts-pattern'
import { KubeClient } from 'infra/kubernetes/client/mod.ts'
import { FederatedResourceQuota } from 'infra/kubernetes/types/karmada.ts'

export async function ensureFederatedResourceQuota(
	kc: KubeClient,
	namespace: string,
	federatedResourceQuota: FederatedResourceQuota,
	abortSignal: AbortSignal,
): Promise<void> {
	const federatedResourceQuotaName = federatedResourceQuota.metadata.name
	await match(
		// Get the federated resource quota and return null if it does not exist
		await kc.KarmadaV1Alpha1(namespace).getFederatedResourceQuota(federatedResourceQuotaName, { abortSignal }).catch(
			() => null,
		),
	)
		// if federated resource quota does not exist, create it
		.with(
			null,
			() => kc.KarmadaV1Alpha1(namespace).createFederatedResourceQuota(federatedResourceQuota, { abortSignal }),
		)
		// if federated resource quota exists, and match values, do nothing, else, patch it to ensure it match
		.with(federatedResourceQuota as any, () => true)
		.otherwise(async () => {
			console.debug('Replacing existing FederatedResourceQuota', federatedResourceQuotaName)
			// Delete the existing federated resource quota first
			await kc.KarmadaV1Alpha1(namespace).deleteFederatedResourceQuota(federatedResourceQuotaName, { abortSignal })
			// Then create the new one
			return kc.KarmadaV1Alpha1(namespace).createFederatedResourceQuota(federatedResourceQuota, { abortSignal })
		})
}
