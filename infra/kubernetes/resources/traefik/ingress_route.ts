import { match } from 'ts-pattern'
import { KubeClient,} from 'infra/kubernetes/client/mod.ts'
import { IngressRoute } from 'infra/kubernetes/types/traefik.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from '../../mod.ts'

export const ensureIngressRoute = createEnsureResourceFunction<IngressRoute>({
	strategy: 'replace',
})

export const deleteIngressRoute = createDeleteResourceFunction<IngressRoute>()