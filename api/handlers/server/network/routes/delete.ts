import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { deleteRoute } from 'core/data/network/route.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  name: z.string().min(1, 'Route name is required'),
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
})

export type Input = z.infer<typeof Input>

export interface DeleteRouteResult {
  name: string
  deleted: boolean
  message: string
}

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  await deleteRoute(
    ctx.kube.client.karmada,
    ctx.project.namespace,
    input.name
  )
  yield `Route ${input.name} deleted`
}
