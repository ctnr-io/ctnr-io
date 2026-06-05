import { Pod } from 'infra/kubernetes/types/core.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensurePod = createEnsureResourceFunction<Pod>({
	strategy: 'patch',
})

export const deletePod = createDeleteResourceFunction<Pod>()
