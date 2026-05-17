import z from 'zod'

export const Input = z.any()
export type Input = z.infer<typeof Input>

export type Output = void

import { WorkerRequest, WorkerResponse } from 'lib/api/types.ts'
import { checkUsage } from 'core/rules/billing/usage.ts'
import { namespaceToProject } from 'core/transform/project.ts'
import type { Project } from 'core/schemas/mod.ts'

export default async function* BillingWorker({ ctx }: WorkerRequest<Input>): WorkerResponse<Output> {
  const controller = new AbortController()
  const abortSignal = controller.signal
  abortSignal.addEventListener('abort', () => {
    controller.abort()
  })
  await Promise.all([
    (async () => {
      while (abortSignal.aborted === false) {
        // Implement every 5 minutes billing check
        // Retrieve all project namespaces and transform to projects
        const namespaces = await ctx.kube.client['karmada'].CoreV1.getNamespaceList(
          { labelSelector: 'ctnr.io/project-id' },
        )

        const projects = namespaces.items.map(namespaceToProject).filter((p): p is Project => Boolean(p.id && p.ownerId))

        for (const project of projects) {
          try {
            try {
              // checkUsage has side effects (scales down deployments) so kept as generator
              for await (
                const _msg of checkUsage({
                  kubeClient: ctx.kube.client['karmada'],
                  namespace: project.namespace,
                  abortSignal,
                })
              ) {
                // console.debug(`Usage check for project ${project.id}:`, _msg)
              }
            } catch (error) {
              if (error instanceof Error) {
                console.warn(`Usage check issue for project ${project.id}:`, error)
              }
            }
          } catch (error) {
            console.error(`Failed to update balance for project ${project.id}:`, error)
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)) // 5 minutes
      }
    })(),
  ])
}
