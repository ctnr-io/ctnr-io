import { z } from 'zod'
import { ServerContext } from 'ctx/mod.ts'
import { ContainerName, ServerResponse } from '../../_common.ts'
import { handleStreams, setupSignalHandling, setupTerminalHandling } from 'lib/streams.ts'
import { getPodsFromAllClusters } from './_utils.ts'

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
  command: z.string()
    .max(1000, 'Command length is limited for security reasons')
    .optional()
    .default('/bin/sh')
    .describe('Command to execute in the container'),
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  replica: z.string().optional().describe(
    'Specific replica name to execute command in. If not provided, will use the first available replica',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* ({ ctx, input }: { ctx: ServerContext; input: Input }): ServerResponse<void> {
  const { name, command = '/bin/sh', interactive = false, terminal = false, replica } = input

  const pods = await getPodsFromAllClusters(ctx, name, replica ? [replica] : undefined)

  if (pods.length === 0) {
    yield `No running pods found for container ${name}.`
    return
  }

  // Use the first available pod
  const podInfo = pods[0]
  const podName = podInfo.pod.metadata?.name!
  const containerName = podInfo.pod.spec?.containers?.[0]?.name!
  const clusterClient = ctx.kube.client[podInfo.cluster as keyof typeof ctx.kube.client]

  const tunnel = await clusterClient.CoreV1.namespace(ctx.kube.namespace).tunnelPodExec(podName, {
    command: command === '/bin/sh' ? ['/bin/sh'] : ['sh', '-c', command],
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
    ctx.stdio?.exit(status.exitCode || 0)
  })

  await handleStreams(ctx, tunnel, interactive, terminal)
}
