import { Pod } from 'infra/kubernetes/types/core.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensurePod = createEnsureResourceFunction<Pod>({
	strategy: 'replace',
})

export const deletePod = createDeleteResourceFunction<Pod>()
