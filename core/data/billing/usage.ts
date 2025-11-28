import type { KubeClient } from 'infra/kubernetes/mod.ts'
import { getUsage as getUsageRule, type Usage } from 'core/rules/billing/usage.ts'
import { ensureFederatedResourceQuota } from 'infra/kubernetes/mod.ts'

export type { Usage }

export interface UsageContext {
	kubeClient: KubeClient
	namespace: string
}

/**
 * Get current usage for a project
 */
export async function getUsage(
	ctx: UsageContext,
	signal: AbortSignal,
): Promise<Usage> {
	const { kubeClient, namespace } = ctx
	return getUsageRule({
		kubeClient,
		namespace,
		signal,
	})
}

export interface SetLimitsInput {
	cpu: string
	memory: string
	storage: string
}

/**
 * Set resource limits for a project
 */
export async function setLimits(
	ctx: UsageContext,
	limits: SetLimitsInput,
	signal: AbortSignal,
): Promise<void> {
	const { kubeClient, namespace } = ctx

	await ensureFederatedResourceQuota(kubeClient, namespace, {
		apiVersion: 'policy.karmada.io/v1alpha1',
		kind: 'FederatedResourceQuota',
		metadata: {
			name: 'ctnr-resource-quota',
			namespace: namespace,
			labels: {},
		},
		spec: {
			overall: {
				'limits.cpu': limits.cpu,
				'limits.memory': limits.memory,
				'requests.storage': limits.storage,
			},
		},
	}, signal)
}
