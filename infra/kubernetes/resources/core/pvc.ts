import { PersistentVolumeClaim } from 'infra/kubernetes/types/core.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensurePersistentVolumeClaim = createEnsureResourceFunction<PersistentVolumeClaim>({
	strategy: 'replace',
})

export const deletePersistentVolumeClaim = createDeleteResourceFunction<PersistentVolumeClaim>()