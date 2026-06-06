import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { stopContainer } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
      'signal': 's',
      "time": 't',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  signal: z.string().default('STOP').describe('Signal to send to the container (e.g., TERM, KILL)'),
  time: z.number().optional().describe('Seconds to wait before killing the container'),
})

export type Input = z.infer<typeof Input>

export default async function* StopContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, abortSignal } = request
  const { name, signal, time } = input

  yield ctx.log.loader(`⏸️ Stopping container ${name}...`)

  await stopContainer({
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
  }, name, signal, time, abortSignal)
}
