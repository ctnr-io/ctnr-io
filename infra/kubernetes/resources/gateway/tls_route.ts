import { TLSRoute } from 'infra/kubernetes/types/gateway.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureTLSRoute = createEnsureResourceFunction<TLSRoute>({
	strategy: 'replace',
})

export const deleteTLSRoute = createDeleteResourceFunction<TLSRoute>()