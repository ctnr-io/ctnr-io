import { HorizontalPodAutoscaler } from 'infra/kubernetes/types/autoscaling.ts'
import { createDeleteResourceFunction, createEnsureResourceFunction } from 'infra/kubernetes/client/resource.ts'

export const ensureHorizontalPodAutoscaler = createEnsureResourceFunction<HorizontalPodAutoscaler>({
	strategy: 'replace',
})

export const deleteHorizontalPodAutoscaler = createDeleteResourceFunction<HorizontalPodAutoscaler>()