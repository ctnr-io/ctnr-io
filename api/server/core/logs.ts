import { z } from 'zod'
import { ContainerName, ServerRequest, ServerResponse } from '../../_common.ts'
import { combineReadableStreamsToGenerator, createReadableStreamFromAsyncGenerator } from 'lib/streams.ts'
import { getPodsFromAllClusters } from './_utils.ts'

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

  const pods = await getPodsFromAllClusters({ ctx, name, replicas, signal: signal })

  // Create log streams for each pod
  const logStreams = (await Promise.all(
    pods.map(async (podInfo) => {
      try {
        const clusterClient = ctx.kube.client[podInfo.cluster as keyof typeof ctx.kube.client]
        const containerName = podInfo.pod.spec?.containers?.[0]?.name!
        const name = podInfo.pod.metadata?.name!

        const stream = await clusterClient.CoreV1.namespace(ctx.kube.namespace).streamPodLog(name, {
          container: containerName,
          follow,
          tailLines: tail,
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

  const streamGenerator = combineReadableStreamsToGenerator(logStreams)
  if (ctx.stdio) {
    const stream = createReadableStreamFromAsyncGenerator(streamGenerator)
    await stream.pipeTo(ctx.stdio.stdout)
    return
  } else {
    for await (const chunk of createReadableStreamFromAsyncGenerator(streamGenerator)) {
      yield chunk.trimEnd() // Trim to avoid extra new lines
    }
  }
}
