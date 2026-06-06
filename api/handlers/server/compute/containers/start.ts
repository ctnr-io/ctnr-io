import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { checkUsage } from 'core/rules/billing/usage.ts'
import { extractPodResourceUsage } from 'core/rules/billing/resource.ts'
import { getContainerPod, startContainer, waitForContainer } from 'core/data/compute/container.ts'
import AttachContainer from './attach.ts'

export const Meta = {
  aliases: {
    options: {
      'attach': 'a',
      'interactive': 'i',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  attach: z.boolean().default(false).describe(`Attach container's STDIN`),
  // TODO: detachKeys: z.string().optional().describe('Override the default detach keys sequence (default: ctrl-p ctrl-q)'),
  interactive: z.boolean().default(false).describe('Attach STDOUT/STDERR and forward signals'),
})

export type Input = z.infer<typeof Input>

export default async function* StartContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, abortSignal } = request
  const { name, interactive } = input

  const containerCtx = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }

  // Fetch pod
  const pod = await getContainerPod(containerCtx, name)

  const resourceUsage = extractPodResourceUsage(pod)

  yield* checkUsage({
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
    abortSignal,
    additionalResource: resourceUsage,
    force: false,
  })

  yield ctx.log.loader(`⚡️ Starting container ${name}`)

  await startContainer(
    {
      kubeClient: ctx.kube.client['karmada'],
      namespace: ctx.project.namespace,
    },
    name,
    abortSignal,
  )

  if (input.attach) {
    await waitForContainer({
      ctx: {
        kubeClient: ctx.kube.client[ctx.project.cluster],
        namespace: ctx.project.namespace,
      },
      name,
      abortSignal,
      predicate: (container) => {
        switch (container.status) {
          case 'created':
          case 'paused':
            return false
          default:
            return true
        }
      },
    })
    yield* AttachContainer({
      ctx,
      input: {
        name,
        noStdin: !interactive,
      },
      abortSignal,
      defer: request.defer,
    })
  }
}
