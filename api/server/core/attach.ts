import { z } from 'zod'
import { ServerContext } from 'ctx/mod.ts'
import { ContainerName, ServerResponse } from './_common.ts'
import { handleStreams, setupSignalHandling, setupTerminalHandling } from './_stream-utils.ts'

export const Meta = {
  aliases: {
    options: {
      interactive: 'i',
      terminal: 't',
    },
  },
}

export const Input = z.object({
  name: ContainerName,
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
})

export type Input = z.infer<typeof Input>

export default async function* ({ ctx, input }: { ctx: ServerContext; input: Input }): ServerResponse<Input> {
  const { name, interactive = false, terminal = false } = input

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
      yield `No running pods found for container ${name}.`
      return
    }

    podName = runningPod.metadata?.name || ''
    // Use the first container name from the pod
    containerName = runningPod.spec?.containers?.[0]?.name || name
  } else {
    // Fallback: try to find the pod directly (for backward compatibility)
    const podResource = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).getPod(name).catch(() => null)
    if (!podResource) {
      yield `Container ${name} not found.`
      return
    }

    if (podResource.status?.phase !== 'Running') {
      yield `Container ${name} is not running (status: ${podResource.status?.phase}).`
      return
    }

    podName = name
    containerName = name
  }

  const tunnel = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).tunnelPodAttach(podName, {
    stdin: interactive,
    tty: terminal,
    stdout: true,
    stderr: true,
    abortSignal: ctx.signal,
    container: containerName,
  })

  setupSignalHandling(ctx, tunnel, terminal, interactive)
  setupTerminalHandling(ctx, tunnel, terminal, interactive)

  if (interactive) {
    yield `Press ENTER if you don't see a command prompt.`
  }

  ctx.defer(async () => {
    // Exit with the command's exit code
    const status = await tunnel.status.then((status) => status)
    ctx.stdio.exit(status.exitCode || 0)
  })

  await handleStreams(ctx, tunnel, interactive, terminal)
}
