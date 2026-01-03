import { ClusterPropagationPolicy } from 'infra/kubernetes/types/mod.ts'
import { createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureClusterPropagationPolicy = createEnsureResourceFunction<ClusterPropagationPolicy>({
	strategy: 'replace',
})
