import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'

export const Meta = {
  aliases: {
    options: {
    },
  },
}

export const Input = z.object({
  name: ContainerName,
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request

  const {
    name,
  } = input


  // Patch deployment to set replicas
  await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).patchDeployment(name, 'json-merge', {
    spec: { replicas: 0, template: {}, selector: {} },
  })

  // Delete horizontal pod autoscaler if it exists
  await ctx.kube.client['karmada'].AutoScalingV2Api.namespace(ctx.kube.namespace).deleteHorizontalPodAutoscaler(name, {
    abortSignal: signal,
  }).catch(() => {})

  yield `⏸️  Stopped containers ${name}`
}