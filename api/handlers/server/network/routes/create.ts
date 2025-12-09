import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ContainerName, PortName } from 'lib/api/schemas.ts'
import getContainer from 'api/handlers/server/compute/containers/get.ts'
import { ContainerData } from 'api/handlers/server/compute/containers/list.ts'
import { ensureRoute } from 'core/data/network/route.ts'
import handleCreateDomain from '../domains/create.ts'
import { isDomainVerified } from 'core/data/network/domain.ts'

export const Meta = {
  aliases: {
    options: {
      port: 'p',
    },
  },
}

export const Input = z.object({
  name: z.string().describe('Route name, must be unique'),
  container: ContainerName,
  domain: z.string().max(0).or(z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/))
    .optional().describe(
      'Parent domain name for the routing',
    ),
  port: PortName.describe(
    'Ports to expose, defaults to all ports of the container',
  ),
  path: z.string().default('/').describe('Path for the route, defaults to "/"'),
  protocol: z.enum(['http', 'https']).default('https').describe('Protocol for the route'),
})

export type Input = z.infer<typeof Input>

export default async function* createRoute(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request

  const kubeClient = ctx.kube.client['karmada']

  try {
    const container = yield* getContainer({
      ...request,
      input: {
        name: input.container,
        fields: ['basic', 'resources'],
        output: 'raw',
      },
    })
    if (!container) {
      throw new Error(`Container ${input.container} not found`)
    }

    // If no ports is not specified, use all ports, if ports length === 0, remove all ports
    const routedPorts: ContainerData['ports'] = []
    const port = container.ports.find((p) => p.name === input.port || p.number.toString() === input.port)
    if (port) {
      routedPorts.push(port)
    }

    if (routedPorts.length === 0) {
      throw new Error(`No ports found for container ${input.container} matching specified ports`)
    }

    const cluster = ctx.project.cluster

    const projectId = ctx.project.id

    // Determine hostname
    const hostname = input.domain || `${input.name}-${projectId}.${cluster}.ctnr.io`

    // Check for domain ownership and create certificate if needed
    if (input.domain) {
      yield* handleCreateDomain({
        ...request,
        input: {
          domain: input.domain,
        },
      })

      // Wait for domain to be verified (simple retry mechanism)
      let verified = false
      for (let attempt = 0; attempt < 10; attempt++) {
        yield `Checking domain verification status for ${input.domain} (attempt ${attempt + 1}/10)...`
        const domainVerified = await isDomainVerified(input.domain!, projectId)
        if (domainVerified) {
          verified = true
          break
        }
        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, 15000))
      }
      if (!verified) {
        throw new Error(`Domain ${input.domain} is not verified yet. Please complete the DNS verification steps and try again.`)
      }
    }


    // Create route using core/data (handles ctnr.io hostnames)
    await ensureRoute(kubeClient, {
      name: input.name,
      namespace: ctx.project.namespace,
      container: input.container,
      hostname,
      ports: routedPorts.map((p) => ({
        name: p.name || `${p.number}`,
        port: p.number,
      })),
      project: { id: ctx.project.id, cluster: ctx.project.cluster },
      path: input.path || '/',
      protocol: input.protocol, 
    }, signal)

    yield `Route created successfully for container ${input.container}:`
    yield `  - https://${hostname}`
  } catch (error) {
    yield `Error creating route`
    throw error
  }
}
