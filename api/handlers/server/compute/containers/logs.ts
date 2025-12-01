import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { combineReadableStreamsToAsyncGenerator } from 'lib/api/streams.ts'
import { ContainerName } from 'lib/api/schemas.ts'
import list from '../../storage/volumes/list.ts'

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
  name: ContainerName,
  follow: z.boolean().optional().default(false).describe('Follow the logs of the container'),
  replica: z.array(z.string()).optional().describe(
    'Specific replicas name to get logs from. If not provided, logs from all replicas will be merged',
  ),
  tail: z.number().min(1).optional().describe('Number of lines to show from the end of the logs'),
  timestamps: z.boolean().optional().default(false).describe('Show timestamps in the logs'),
})

export type Input = z.infer<typeof Input>

export default async function* ({ ctx, input, signal }: ServerRequest<Input>): ServerResponse<void> {
  const { name, replica: replicas, follow, timestamps, tail } = input

  const clusterClient = ctx.kube.client[ctx.project.cluster]

  let pods = await clusterClient.CoreV1.namespace(ctx.project.namespace).getPodList({
    labelSelector: `ctnr.io/name=${name}`,
    abortSignal: signal,
  }).then(list => list.items)

  if (pods.length === 0) {
    throw new Error(`No replicas found for container ${name}`)
  }

  // Filter by replica if specified
  pods = replicas && replicas.length > 0
    ? pods.filter((pod) => replicas.includes(pod.metadata?.name || ''))
    : pods

  const tailLines = tail ? Math.floor(tail / pods.length) : undefined

  // Create log streams for each pod
  const logStreams = (await Promise.all(
    pods.map(async (pod) => {
      try {
        const containerName = pod.spec?.containers?.[0]?.name!
        const name = pod.metadata?.name!

        const stream = await clusterClient.CoreV1.namespace(ctx.project.namespace).streamPodLog(name, {
          container: containerName,
          follow,
          tailLines,
          timestamps,
          abortSignal: signal,
        })

        return { stream, name }
      } catch (error) {
        console.warn(`Failed to get logs from pod ${name}:`, error)
        return null
      }
    }),
  )).filter(Boolean) as { stream: ReadableStream<string>; name: string }[]

  if (logStreams.length === 0) {
    throw new Error(`Failed to get logs from any replica for ${name}`)
  }

  const streamGenerator = combineReadableStreamsToAsyncGenerator(logStreams)
  for await (const chunk of streamGenerator) {
    yield chunk.trimEnd() // Trim to avoid extra new lines
  }
}
