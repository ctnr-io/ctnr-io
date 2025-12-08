import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { stopContainer } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
})

export type Input = z.infer<typeof Input>

export default async function* stopContainerHandler(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request
  const { name } = input

  await stopContainer({
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }, name, signal)

  yield `⏸️  Stopped containers ${name}`
}
