import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { handleStreams, setupSignalHandling, setupTerminalHandling } from 'lib/api/streams.ts'
import { Command, ContainerName } from 'lib/api/schemas.ts'

export const Meta = {
  aliases: {
    options: {
      interactive: 'i',
      terminal: 't',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  command: Command
    .default(['/bin/sh'])
    .meta({ positional: true }),
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  replica: z.string().optional().describe(
    'Specific replica name to execute command in. If not provided, will use the first available replica',
  ),
})

export type Input = z.infer<typeof Input>

export default async function* ExecContainer({ ctx, input, abortSignal, defer }: ServerRequest<Input>): ServerResponse<void> {
  const { name, command, interactive = false, terminal = false, replica } = input

  const clusterClient = ctx.kube.client[ctx.project.cluster]

  const pods = await clusterClient.CoreV1.namespace(ctx.project.namespace).getPodList({
    labelSelector: `ctnr.io/name=${name}`,
    abortSignal,
  }).then(list => list.items)

  if (pods.length === 0) {
    throw new Error(`No replicas found for container ${name}`)
  }

  // Filter by replica if specified
  const [pod] = replica
    ? pods.filter((pod) => replica.includes(pod.metadata?.name || ''))
    : pods

  const podName = pod.metadata?.name!
  const containerName = pod.spec?.containers?.[0]?.name!

  const tunnel = await clusterClient.CoreV1.namespace(ctx.project.namespace).tunnelPodExec(podName, {
    command,
    stdin: interactive,
    tty: terminal,
    stdout: true,
    stderr: true,
    abortSignal,
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

  await handleStreams({ ctx, abortSignal, defer, tunnel, interactive, terminal })
}
