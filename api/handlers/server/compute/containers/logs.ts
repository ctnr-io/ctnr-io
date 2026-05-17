import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { createReadLineAsyncGeneratorFromReadableStream } from 'lib/api/streams.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import { getContainer } from 'core/data/compute/container.ts'

export const Meta = {
  aliases: {
    options: {
      'follow': 'f',
      'tail': 'n',
      'timestamps': 't',
    },
  },
}

export const Input = z.object({
  name: ContainerName.meta({ positional: true }),
  // TODO: LogContainer details flag
  details: z.boolean().optional().describe('Show extra details provided to logs').describe('(not implemented)'),
  follow: z.boolean().optional().describe('Follow log output'),
  // TODO: LogCntainer since flag
  since: z.string().optional().describe(
    'Show logs since timestamp (e.g. "2013-01-02T13:23:37Z") or relative (e.g. "42m" for 42 minutes)',
  ).describe("(not implemented)"),
  tail: z.string().optional().describe('Number of lines to show from the end of the logs (default "all")'),
  timestamps: z.boolean().optional().describe('Show timestamps'),
  // TODO: LogContainer until flag
  until: z.string().optional().describe(
    'Show logs before a timestamp (e.g. "2013-01-02T13:23:37Z") or relative (e.g. "42m" for 42 minutes)',
  ).describe('(not implemented)'),
})

export type Input = z.infer<typeof Input>

export default async function* LogContainer({ ctx, input, abortSignal }: ServerRequest<Input>): ServerResponse<void> {
  const { name, follow, timestamps, tail } = input

  const kubeClient = ctx.kube.client[ctx.project.cluster]

  const container = await getContainer({
    kubeClient,
    namespace: ctx.project.namespace,
  }, name)

  const tailLines = !tail ? undefined : (tail === 'all' ? undefined : parseInt(tail, 10))

  // Create log streams for each pod
  const stream = await kubeClient.CoreV1.namespace(ctx.project.namespace).streamPodLog(name, {
    container: container.name,
    follow,
    tailLines,
    timestamps,
    abortSignal,
  })

  const readlineGenerator = createReadLineAsyncGeneratorFromReadableStream(stream)
  for await (const line of readlineGenerator) {
    yield line
  }
}
