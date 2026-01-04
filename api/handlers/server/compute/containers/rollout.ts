import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { getDeployment } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
})

export type Input = z.infer<typeof Input>

export default async function* rolloutContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request
  const { name } = input

  const containerCtx = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }

  // Fetch deployment to verify it exists
  const deployment = await getDeployment(containerCtx, name)
  if (!deployment) {
    throw new Error(`Deployment '${name}' not found`)
  }

  const replicas = deployment.spec?.replicas ?? 0
  if (replicas === 0) {
    throw new Error(`Cannot rollout stopped container '${name}'. Start it first.`)
  }

  yield `🔄 Rolling out container '${name}'...`

  // Trigger rolling restart by updating the restart annotation
  // This is the Kubernetes-native way to perform a rolling update without downtime
  const restartedAt = new Date().toISOString()
  
  await containerCtx.kubeClient.AppsV1.namespace(containerCtx.namespace).patchDeployment(
    name,
    'json-merge',
    {
      spec: {
        template: {
          metadata: {
            annotations: {
              'kubectl.kubernetes.io/restartedAt': restartedAt,
            },
          },
        },
        selector: {},
      },
    },
    {
      abortSignal: signal,
    },
  )

  yield `✅ Rollout initiated for container '${name}'`
  yield `   Kubernetes will perform a rolling update with zero downtime`
  yield `   Old pods will be terminated only after new pods are ready`
}
