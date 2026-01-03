import { Namespace } from 'infra/kubernetes/types/core.ts'
import { createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureNamespace = createEnsureResourceFunction<Namespace>({
	strategy: 'update', //  Never replace namespaces, just update them
})