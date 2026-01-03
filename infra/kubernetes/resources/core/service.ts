import { Service } from 'infra/kubernetes/types/core.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureService = createEnsureResourceFunction<Service>({
	strategy: 'replace',
})

export const deleteService = createDeleteResourceFunction<Service>()