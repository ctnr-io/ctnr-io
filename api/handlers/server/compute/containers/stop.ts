import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { ContainerRepository } from 'core/repositories/mod.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: ContainerName,
})

export type Input = z.infer<typeof Input>

export default async function* stopContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request
  const { name } = input

  const repo = new ContainerRepository(ctx.kube.client, ctx.project)
  await repo.stop(name, signal)

  yield `⏸️  Stopped containers ${name}`
}
