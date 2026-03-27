import { Middleware } from 'infra/kubernetes/types/traefik.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from '../../mod.ts'

export const ensureMiddleware = createEnsureResourceFunction<Middleware>({
	strategy: 'replace',
})

export const deleteMiddleware = createDeleteResourceFunction<Middleware>()
