import z from 'zod'

export const Input = z.any()
export type Input = z.infer<typeof Input>

export type Output = void

import { WorkerRequest, WorkerResponse } from 'lib/api/types.ts'
import { checkUsage, getUsage } from 'lib/billing/usage.ts'

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
        // Retrieve all namespaces and check their usage
        const namespaces = await ctx.kube.client['eu'].CoreV1.getNamespaceList(
          { labelSelector: 'ctnr.io/owner-id' },
        )

        for (const ns of namespaces.items) {
          const namespace = ns.metadata?.name
          const userId = ns.metadata?.labels?.['ctnr.io/owner-id']

          if (!namespace) continue
          try {
            console.debug(`Updating balance for namespace ${namespace} (owner: ${userId})`)
            const usage = await getUsage({
              kubeClient: ctx.kube.client['eu'],
              namespace,
              signal,
            })
            try {
              for await (const msg of checkUsage({
                kubeClient: ctx.kube.client['eu'],
                namespace,
                signal,
              })) {
                console.debug(`Usage check for namespace ${namespace}:`, msg)
              }
            } catch (error) {
              console.warn(`Usage check issue for namespace ${namespace}:`, error)
            }
            console.debug(`Balance updated for namespace ${namespace}:`, usage.balance)
          } catch (error) {
            console.error(`Failed to update balance for namespace ${namespace}:`, error)
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000)) // 5 minutes
      }
    })(),
  ])
}
