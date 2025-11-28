import { z } from 'zod'
import { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import attachContainer from './attach.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import logContainer from './logs.ts'
import { getPodsFromAllClusters } from './_utils.ts'
import createContainer, * as CreateContinaer from './create.ts'
import startContainer from './start.ts'

export const Meta = {
  aliases: {
    options: {
      'interactive': 'i',
      'terminal': 't',
      'publish': 'p',
    },
  },
}

// Volume mount specification
const VolumeMount = z.string()
  .regex(
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?:\/[^:]*(?::\d+[G]?)?$/,
    'Volume format must be name:path or name:path:size (e.g., "data:/app/data" or "data:/app/data:5G")',
  )
  .describe('Volume mount in format name:path:size (size optional, defaults to 1G)')

export const Input = CreateContinaer.Input.extend({
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  detach: z.boolean().optional().default(false).describe('Detach from the container after starting'),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal, defer } = request

  const {
    interactive,
    terminal,
    detach,
    replicas,
  } = input

  // Create the container first
  yield* createContainer(request)

  // Start the deployment
  yield* startContainer(request)

  // Parse replicas parameter
  let replicaCount: number

  if (typeof replicas === 'string') {
    // Range format: "1-5"
    const [min] = replicas.split('-').map(Number)
    replicaCount = min // Start with minimum
  } else {
    // Single number
    replicaCount = replicas as number
  }

  yield `\r\nContainers ${name} is running with ${replicaCount} replica(s).`

  // Get the first pod for interactive/terminal operations
  let pod: Pod | null = null
  if (interactive || terminal || !detach) {
    // Use the same multi-cluster approach as logs/attach/exec
    try {
      const pods = await getPodsFromAllClusters({
        ctx,
        name,
        signal,
      })
      pod = pods.length > 0 ? pods[0].pod : null
    } catch (error) {
      console.warn(`Failed to get pods from clusters:`, error)
      // Fallback to checking eu cluster directly
      const pods = await ctx.kube.client['karmada'].CoreV1.namespace(ctx.project.namespace).getPodList({
        labelSelector: `ctnr.io/name=${name}`,
      })
      pod = pods.items.find((p) => p.status?.phase === 'Running') || null
    }
  }

  if (detach) {
    // If detach is enabled, just return without attaching
    yield `Containers ${name} is running. Detached successfully.`
    return
  } else if (pod?.status?.phase === 'Running') {
    // Logs
    // Attach to the pod if interactive or terminal mode is enabled
    yield* attachContainer({
      ctx,
      input: {
        name,
        interactive,
        terminal,
      },
      signal,
      defer,
    })
  } else {
    yield* logContainer({
      ctx,
      input: {
        name,
        follow: true,
        timestamps: false,
      },
      signal,
      defer,
    })
  }
}
