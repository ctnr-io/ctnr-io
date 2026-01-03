import { FederatedResourceQuota } from 'infra/kubernetes/types/mod.ts'
import { createEnsureResourceFunction } from '../../client/resource.ts'

export const ensureFederatedResourceQuota = createEnsureResourceFunction<FederatedResourceQuota>({
	strategy: 'replace',
})
