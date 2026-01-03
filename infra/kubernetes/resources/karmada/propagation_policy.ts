import { PropagationPolicy } from 'infra/kubernetes/types/mod.ts'
import { createEnsureResourceFunction } from '../../client/resource.ts'

export const ensurePropagationPolicy = createEnsureResourceFunction<PropagationPolicy>({
	strategy: 'replace',
})
