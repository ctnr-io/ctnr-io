import { Certificate } from 'infra/kubernetes/types/cert_manager.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureCertificate = createEnsureResourceFunction<Certificate>({
	strategy: 'replace',
})

export const deleteCertificate = createDeleteResourceFunction<Certificate>()