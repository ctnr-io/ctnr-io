import z from 'zod'

export const Input = z.any()
export type Input = z.infer<typeof Input>

export type Output = void

import { WorkerRequest, WorkerResponse } from 'lib/api/types.ts'
import { checkUsage } from 'core/application/billing/usage.ts'
import { UsageRepository } from 'core/repositories/mod.ts'
import { namespaceToProject } from 'core/adapters/kubernetes/transform/project.ts'
import { Project } from 'core/entities/mod.ts'

export default async function* ({ ctx }: WorkerRequest<Input>): WorkerResponse<Output> {
  const controller = new AbortController()
  const signal = controller.signal
  signal.addEventListener('abort', () => {
    controller.abort()
  })
  await Promise.all([
    (async () => {
      while (signal.aborted === false) {
        // Implement every 5 minutes billing check
        // Retrieve all project namespaces and transform to projects
        const namespaces = await ctx.kube.client['karmada'].CoreV1.getNamespaceList(
          { labelSelector: 'ctnr.io/project-id' },
        )

        const projects = namespaces.items.map(namespaceToProject).filter((p: Project) => p.id && p.ownerId)

        for (const project of projects) {
          try {
            console.debug(`Updating balance for project ${project.id} (namespace: ${project.namespace})`)

            const usageRepo = new UsageRepository(
              ctx.kube.client,
              { id: project.id, namespace: project.namespace, cluster: project.cluster },
            )
            const usage = await usageRepo.get({}, signal)

            try {
              // checkUsage has side effects (scales down deployments) so kept as generator
              for await (
                const _msg of checkUsage({
                  kubeClient: ctx.kube.client['karmada'],
                  namespace: project.namespace,
                  signal,
                })
              ) {
                // console.debug(`Usage check for project ${project.id}:`, _msg)
              }
            } catch (error) {
              if (error instanceof Error) {
                console.warn(`Usage check issue for project ${project.id}:`, error.message)
              }
            }
            console.debug(`Balance updated for project ${project.id}:`, usage.balance)
          } catch (error) {
            console.error(`Failed to update balance for project ${project.id}:`, error)
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)) // 5 minutes
      }
    })(),
  ])
}
