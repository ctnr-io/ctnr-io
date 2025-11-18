import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { deleteUserRoute } from 'lib/kubernetes/kube-client.ts'

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
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<void> {
  const kubeClient = ctx.kube.client['karmada'] // Currently only 'karmada' cluster is supported
  await deleteUserRoute(
    kubeClient,
    ctx.project.namespace,
    input.name,
    signal,
  )
}
