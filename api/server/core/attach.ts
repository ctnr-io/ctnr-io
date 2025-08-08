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

  const tunnel = await ctx.kube.client.CoreV1.namespace(ctx.kube.namespace).tunnelPodAttach(name, {
    stdin: interactive,
    tty: terminal,
    stdout: true,
    stderr: true,
    abortSignal: ctx.signal,
    container: name,
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
