import { z } from 'zod'
import { ServerContext } from 'ctx/mod.ts'
import { ContainerName } from './_common.ts'

export const Meta = {
  aliases: {
    options: {
      'follow': 'f',
    },
  },
}

export const Input = z.object({
  name: ContainerName,
  follow: z.boolean().optional().default(false).describe('Follow the logs of the container'),
})

export type Input = z.infer<typeof Input>

export default async ({ ctx, input }: { ctx: ServerContext; input: Input }) => {
  const { name } = input

  // First, try to find the deployment
  const deployment = await ctx.kube.client.AppsV1.namespace(ctx.kube.namespace).getDeployment(name).catch(() => null)

  let podName: string
  let containerName: string = name

  if (deployment) {
    // Find a running pod from the deployment
    const pods = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPodList({
      labelSelector: `ctnr.io/name=${name}`,
    })

    const runningPod = pods.items.find((pod) => pod.status?.phase === 'Running')
    if (!runningPod) {
      throw new Error(`No running pods found for container ${name}.`)
    }

    podName = runningPod.metadata?.name || ''
    // Use the first container name from the pod
    containerName = runningPod.spec?.containers?.[0]?.name || name
  } else {
    // Fallback: try to find the pod directly (for backward compatibility)
    const podResource = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(name).catch(() => null)
    if (!podResource) {
      throw new Error(`Container ${name} not found.`)
    }

    if (podResource.status?.phase !== 'Running') {
      throw new Error(`Container ${name} is not running (status: ${podResource.status?.phase}).`)
    }

    podName = name
    containerName = name
  }

  const logs = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).streamPodLog(podName, {
    container: containerName,
    abortSignal: ctx.signal,
    follow: input.follow,
  })
  await logs.pipeTo(ctx.stdio.stdout, {
    signal: ctx.signal,
  })
}
