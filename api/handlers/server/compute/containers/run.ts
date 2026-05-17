import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import LogContainer from './logs.ts'
import CreateContainer, * as CreateContainerModule from './create.ts'
import StartContainer from './start.ts'
import RouteContainer from './route.ts'
import AttachContainer from './attach.ts'
import { waitForContainer } from 'core/data/compute/container.ts'
import { Container } from 'core/schemas/mod.ts'

export const Meta = {
  aliases: {
    options: {
      'interactive': 'i',
      'terminal': 't',
      'publish': 'p',
      'route': 'r',
      'detach': 'd',
      'env': 'e',
      'volume': 'v',
    },
  },
}

export const Input = CreateContainerModule.Input.extend({
  interactive: z.boolean().optional().default(false).describe('Run interactively'),
  terminal: z.boolean().optional().default(false).describe('Run in a terminal'),
  detach: z.boolean().optional().default(false).describe('Detach from the container after starting'),
  route: z.string()
    .optional().describe(
      "Route container's published ports. Format is <port-name> or <port-number>. If not specified, all published ports are routed.",
    ),
})

export type Input = z.infer<typeof Input>

export default async function* RunContainer(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, abortSignal, defer } = request

  const {
    interactive,
    terminal,
    detach,
    publish,
  } = input

  const { name } = yield* CreateContainer(request)

  yield* StartContainer({
    ...request,
    input: {
      ...input,
      name,
      attach: false, // We will handle attach separately based on the detach/interactive options
      interactive: false, // We will handle interactive separately
    },
  })

  // Note: Service management is now handled by the route command
  // The --publish flag only affects container port configuration
  if (publish && publish.length > 0) {
    yield `Containers ports are available for routing.`

    if (input.route) {
      // Route the container's published ports to a domain
      try {
        yield* RouteContainer({
          ctx,
          input: {
            name,
            port: input.route,
            domain: input.domain,
          },
          abortSignal,
          defer,
        })
      } catch (err) {
        console.error(`Failed to route container ${name}:`, err)
        yield `Failed to route container ${name}`
      }
    }
  }

  yield `Waiting for container running`

  // Wait for container running, exit, or dead
  const container = await waitForContainer({
    ctx: {
      kubeClient: ctx.kube.client[ctx.project.cluster],
      namespace: ctx.project.namespace,
    },
    name,
    abortSignal,
    predicate: (container) => {
      switch (container.status) {
        case 'running':
        case 'exited':
        case 'dead':
          return true
        default:
          return false
      }
    },
  })

  if (detach) {
    // If detach is enabled, just return without attaching
    yield `Containers ${name} is ${container.status}.`
    return
  }
  
  if (container?.status === 'running') {
    // Logs
    // Attach to the pod if interactive or terminal mode is enabled
    yield* AttachContainer({
      ctx,
      input: {
        name,
        noStdin: !interactive,
      },
      abortSignal,
      defer,
    })
  } else {
    yield* LogContainer({
      ctx,
      input: {
        name,
        follow: true,
        timestamps: false,
      },
      abortSignal,
      defer,
    })
  }
}
