import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { getUsage } from 'lib/billing/usage.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({
})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = Awaited<ReturnType<typeof getUsage>>

export default async function* (
  { ctx, signal }: ServerRequest<Input>,
): ServerResponse<Output> {
  const kubeClient = ctx.kube.client['karmada']
  const namespace = ctx.kube.namespace

  return await getUsage({
    kubeClient,
    namespace,
    signal,
  })
}
