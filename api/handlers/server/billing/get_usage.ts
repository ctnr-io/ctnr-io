import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { getUsage, type Usage, type UsageContext } from 'core/data/billing/usage.ts'

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
  const usageCtx: UsageContext = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
  }

  return await getUsage(usageCtx, signal)
}
