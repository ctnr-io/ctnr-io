import { CiliumNetworkPolicy } from 'infra/kubernetes/types/cilium.ts'
import { createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureCiliumNetworkPolicy = createEnsureResourceFunction<CiliumNetworkPolicy>({
	strategy: 'replace',
})