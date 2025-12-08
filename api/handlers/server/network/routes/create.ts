import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { ContainerName, PortName } from 'lib/api/schemas.ts'
import { isDomainVerified, verifyDomainOwnership } from 'infra/dns/mod.ts'
import getContainer from 'api/handlers/server/compute/containers/get.ts'
import { ContainerData } from 'api/handlers/server/compute/containers/list.ts'
import { ensureRoute } from 'core/data/network/route.ts'

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
  domain: z.string().max(0).or(z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/)).optional().describe(
    'Parent domain name for the routing',
  ),
  port: z.array(PortName).optional().describe(
    'Ports to expose, defaults to all ports of the container',
  ),
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
    if (input.port === undefined) {
      routedPorts.push(...container.ports)
    } else if (input.port.length === 0) {
      // No ports to route
    } else {
      for (const portNameOrNumber of input.port) {
        const port = container.ports.find((p) =>
          p.name === portNameOrNumber || p.number.toString() === portNameOrNumber
        )
        if (port) {
          routedPorts.push(port)
        }
      }
    }

    if (routedPorts.length === 0) {
      throw new Error(`No ports found for container ${input.container} matching specified ports`)
    }

    const cluster = ctx.project.cluster

    const projectId = ctx.project.id
    
    // Build hostnames for ctnr.io domain
    const ctnrHostnames = routedPorts.map((port) =>
      `${port.name}-${input.container}-${projectId}.${cluster}.ctnr.io`
    )
    
    // Build hostnames for custom domain (if provided)
    const customHostnames: string[] = []
    if (input.domain) {
      customHostnames.push(...routedPorts.map((port) => `${port.name}.${input.domain}`))
    }

    // Check for domain ownership and create certificate if needed
    if (input.domain) {
      const rootDomain = input.domain.split('.').slice(-2).join('.')

      // Check if domain is already verified
      const alreadyVerified = yield* isDomainVerified(
        input.domain,
        ctx.project.id,
        ctx.project.cluster,
      )

      if (!alreadyVerified) {
        yield `Domain ownership verification required for ${rootDomain}`
        yield* verifyDomainOwnership({
          domain: input.domain,
          projectId: ctx.project.id,
          cluster: ctx.project.cluster,
          signal,
        })
      }
    }

    // Create route using core/data (handles ctnr.io hostnames)
    const allHostnames = [...ctnrHostnames, ...customHostnames]
    await ensureRoute(kubeClient, {
      name: input.name,
      namespace: ctx.project.namespace,
      container: input.container,
      hostnames: allHostnames,
      ports: routedPorts.map((p) => ({
        name: p.name || `${p.number}`,
        port: p.number,
      })),
    }, signal)

    yield `Routes created successfully for container ${input.container}:`
    for (const hostname of allHostnames) {
      yield `  - https://${hostname}`
    }
  } catch (error) {
    yield `Error creating route`
    throw error
  }
}
