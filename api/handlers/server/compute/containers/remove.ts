import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { deleteContainer, getContainerPod } from 'core/data/compute/container.ts'
import { convertPodToContainerStatus } from 'core/transform/container.ts'

export const Meta = {
  aliases: {
    options: {
      'force': 'f',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  force: z.boolean().optional().describe('Force delete even if container is running'),
})

export type Input = z.infer<typeof Input>

export default async function* RemoveContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, abortSignal } = request
  const { name, force } = input

  yield ctx.log.loader(`🗑️ Removing container ${name}...`)

  const containerCtx = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }

  // Check if pod exists
  const pod = await getContainerPod(containerCtx, name)

  const containerStatus = convertPodToContainerStatus(pod)
  if (containerStatus === 'running' && !force) {
    throw new Error('Container is still running. Use --force to stop and remove it.')
  }

  // Delete the pod
  await deleteContainer(containerCtx, name, abortSignal)
}
