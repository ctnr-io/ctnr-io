import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { handleStreams, setupSignalHandling, setupTerminalHandling } from 'lib/api/streams.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { getContainer } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  // TODO: AttachContainer detachKeys flag
  detachKeys: z.string().optional().describe('Override the key sequence for detaching a container').describe('not implemented'),
  noStdin: z.boolean().optional().describe('Do not attach STDIN'),
  // TODO: AttachContainer sigProxy flag
  sigProxy: z.boolean().optional().describe('Proxy all received signals to the process').describe('not implemented'),
})

export type Input = z.infer<typeof Input>

export default async function* AttachContainer({ ctx, input, abortSignal, defer }: ServerRequest<Input>): ServerResponse<void> {
  const { name, noStdin = false } = input

  const interactive = !noStdin

  const kubeClient = ctx.kube.client[ctx.project.cluster]

  const container = await getContainer({
    kubeClient,
    namespace: ctx.project.namespace,
  }, name)

  const { terminal } = container

  const tunnel = await kubeClient.CoreV1.namespace(ctx.project.namespace).tunnelPodAttach(name, {
    stdin: interactive,
    tty: terminal,
    stdout: true,
    stderr: true,
    abortSignal,
    container: container.name,
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

  await handleStreams({
    ctx,
    abortSignal,
    defer,
    interactive,
    terminal,
    tunnel: {
      stdin: interactive ? tunnel.stdin : undefined,
      stdout: tunnel.stdout,
      stderr: tunnel.stderr,
    },
  })
}
