import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ensureUserRoute } from 'lib/kubernetes/kube-client.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { ContainerName, PortName } from 'lib/api/schemas.ts'
import { isDomainVerified, verifyDomainOwnership } from 'lib/domains/verification.ts'
import getContainer from 'api/server/compute/containers/get.ts'
import { string } from 'zod'

export const Meta = {
  aliases: {
    options: {
      port: 'p',
    },
  },
}

export const Input = z.object({
  name: string,
  container: ContainerName,
  domain: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/).optional().describe(
    'Parent domain name for the routing',
  ),
  port: z.array(PortName).optional().describe(
    'Ports to expose, defaults to all ports of the container',
  ),
})

export type Input = z.infer<typeof Input>

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36)

export default async function* createRoute(request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request

  const kubeClient = ctx.kube.client['karmada']

  try {
    const container = yield* getContainer({
      ...request,
      input: {
        name: input.container,
      },
    })
    if (!container) {
      throw new Error(`Container ${input.container} not found`)
    }

    // If no ports is not specified, use all ports, if ports length === 0, remove all ports
    const routedPorts = (
      input.port === undefined ? container.ports : input.port.length === 0 ? [] : container.ports
    ).filter((p) => input.port!.includes(p.name ?? '') || input.port!.includes(p.number.toString()))

    if (routedPorts.length === 0) {
      throw new Error(`No ports found for container ${input.container} matching specified ports`)
    }

    const clusters = 

    const userIdShort = shortUUIDtranslator.fromUUID(ctx.auth.user.id)
    const hostnames = [
      ...routedPorts.map((port) => [
        ...clusters.map((cluster) => `${port.name}-${input.container}-${userIdShort}.${cluster}.ctnr.io`),
        input.domain! && `${port.name}.${input.domain}`,
      ]),
    ].flat().filter(Boolean)

    // Check for domain ownership and create certificate if needed
    if (input.domain) {
      const rootDomain = input.domain.split('.').slice(-2).join('.')

      // Check if domain is already verified
      const alreadyVerified = yield* isDomainVerified(
        input.domain,
        ctx.auth.user.id,
        ctx.auth.user.createdAt,
      )

      if (!alreadyVerified) {
        yield `Domain ownership verification required for ${rootDomain}`
        yield* verifyDomainOwnership({
          domain: input.domain,
          userId: ctx.auth.user.id,
          userCreatedAt: ctx.auth.user.createdAt,
          signal,
        })
      }
    }

    await ensureUserRoute(kubeClient, ctx.kube.namespace, {
      hostnames,
      name: input.container,
      userId: ctx.auth.user.id,
      ports: routedPorts.map((p) => ({
        name: p.name || `${p.number}`,
        port: p.number,
      })),
      clusters,
    }, signal)

    yield `Routes created successfully for container ${input.container}:`
    for (const hostname of hostnames) {
      yield `  - https://${hostname}`
    }
  } catch (error) {
    yield `Error creating route`
    throw error
  }
}
