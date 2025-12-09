import { z } from 'zod'
import { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import attachContainer from './attach.ts'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import logContainer from './logs.ts'
import createContainer, * as CreateContinaer from './create.ts'
import startContainer from './start.ts'
import routeContainer from './route.ts'

export const Meta = {
  aliases: {
    options: {
      'interactive': 'i',
      'terminal': 't',
      'publish': 'p',
    },
  },
}

export const Input = CreateContinaer.Input.extend({
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  detach: z.boolean().optional().default(false).describe('Detach from the container after starting'),
  route: z.string()
    .optional().describe(
      "Route container's published ports. Format is <port-name> or <port-number>. If not specified, all published ports are routed.",
    ),
})

export type Input = z.infer<typeof Input>

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal, defer } = request

  const clusterClient = ctx.kube.client[ctx.project.cluster]

  const {
    name,
    interactive,
    terminal,
    detach,
    replicas,
    publish,
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
    // Use the same approach as logs/attach/exec
    try {
      const pods = await clusterClient.CoreV1.namespace(ctx.project.namespace).getPodList({
        labelSelector: `ctnr.io/name=${name}`,
        abortSignal: signal,
      }).then((list) => list.items)

      if (pods.length === 0) {
        throw new Error(`No replicas found for container ${name}`)
      }

      pod = pods.length > 0 ? pods[0] : null
    } catch (error) {
      console.warn(`Failed to get pods from clusters:`, error)
      // Fallback to checking eu cluster directly
      const pods = await ctx.kube.client['karmada'].CoreV1.namespace(ctx.project.namespace).getPodList({
        labelSelector: `ctnr.io/name=${name}`,
      })
      pod = pods.items.find((p) => p.status?.phase === 'Running') || null
    }
  }

  // Note: Service management is now handled by the route command
  // The --publish flag only affects container port configuration
  if (publish && publish.length > 0) {
    yield `Containers ports are available for routing.`

    if (input.route) {
      // Route the container's published ports to a domain
      try {
        yield* routeContainer({
          ctx,
          input: {
            name,
            port: input.route,
            domain: input.domain,
          },
          signal,
          defer,
        })
      } catch (err) {
        console.error(`Failed to route container ${name}:`, err)
        yield `Failed to route container ${name}`
      }
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
