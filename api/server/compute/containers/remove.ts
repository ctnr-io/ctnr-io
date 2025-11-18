import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { extractDeploymentCurrentResourceUsage } from 'lib/billing/resource.ts'
import stop from './stop.ts'

export const Meta = {
  aliases: {
    options: {
      'force': 'f',
    },
  },
}

export const Input = z.object({
  name: ContainerName,
  force: z.boolean().optional().describe('Force delete even if container is running'),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request

  const {
    name,
  } = input

  // Check if deployment
  const deployment = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace).getDeployment(name).catch(() =>
    null
  )
  if (!deployment) {
    yield `❌ Container ${name} not found`
    return
  }

  const currentResources = extractDeploymentCurrentResourceUsage(deployment)
  if (currentResources.replicas > 0 && !input.force) {
    yield `⚠️ Container ${name} is currently running with ${currentResources.replicas} replicas. Use --force to stop and remove it.`
    return
  } else {
    yield* stop(request)
  }

  // Delete the deployment
  await ctx.kube.client['karmada'].AppsV1.namespace(ctx.project.namespace).deleteDeployment(name, {
    abortSignal: signal,
  })

  yield `🗑️  Container ${name} has been removed`
}
