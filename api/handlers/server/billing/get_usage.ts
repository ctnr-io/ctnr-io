import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { UsageRepository, type Usage } from 'core/repositories/mod.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = Usage

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<Output> {
  const usageRepository = new UsageRepository(
    ctx.kube.client,
    {
      id: ctx.project.id,
      namespace: ctx.project.namespace,
      cluster: ctx.project.cluster,
    },
  )

  return await usageRepository.get({}, signal)
}
