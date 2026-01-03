import { HTTPRoute } from 'infra/kubernetes/types/gateway.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureHTTPRoute = createEnsureResourceFunction<HTTPRoute>({
	strategy: 'replace',
})

export const deleteHTTPRoute = createDeleteResourceFunction<HTTPRoute>()