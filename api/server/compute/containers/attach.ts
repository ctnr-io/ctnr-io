import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { handleStreams, setupSignalHandling, setupTerminalHandling } from 'lib/api/streams.ts'
import { getPodsFromAllClusters } from './_utils.ts'
import { ContainerName } from 'lib/api/schemas.ts'

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
  replica: z.string().optional().describe(
    'Specific replica name to attach to. If not provided, will attach to the first available replica',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* ({ ctx, input, signal, defer }: ServerRequest<Input>): ServerResponse<void> {
  const { name, interactive = false, terminal = false, replica } = input

  const pods = await getPodsFromAllClusters({
    ctx,
    name,
    replicas: replica ? [replica] : undefined,
    signal,
  })

  if (pods.length === 0) {
    yield `No running pods found for container ${name}.`
    return
  }

  // Use the first available pod
  const podInfo = pods[0]
  const podName = podInfo.pod.metadata?.name!
  const containerName = podInfo.pod.spec?.containers?.[0]?.name!
  const clusterClient = ctx.kube.client[podInfo.cluster as keyof typeof ctx.kube.client]

  const tunnel = await clusterClient.CoreV1.namespace(ctx.kube.namespace).tunnelPodAttach(podName, {
    stdin: interactive,
    tty: terminal,
    stdout: true,
    stderr: true,
    abortSignal: signal,
    container: containerName,
  })

  setupSignalHandling({ ctx, defer, tunnel, terminal, interactive })
  setupTerminalHandling({ ctx, defer, tunnel, terminal, interactive })

  if (interactive) {
    yield `Press ENTER if you don't see a command prompt.`
  }

  defer(async () => {
    // Exit with the command's exit code
    const status = await tunnel.status.then((status) => status)
    ctx.stdio?.exit(status.exitCode || 0)
  })

  await handleStreams({ ctx, signal, defer, tunnel, interactive, terminal })
}
