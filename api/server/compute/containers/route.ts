import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ensureUserRoute } from 'lib/kubernetes/kube-client.ts'
import * as shortUUID from '@opensrc/short-uuid'
import { ContainerName, PortName } from 'lib/api/schemas.ts'
import { verifyDomainOwnership, isDomainVerified } from 'lib/domains/verification.ts'
import { createDomainCertificate } from 'lib/domains/certificate.ts'

export const Meta = {
  aliases: {
    options: {
      port: 'p',
    },
  },
}

export const Input = z.object({
  name: ContainerName,
  domain: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/).optional().describe(
    'Parent domain name for the routing',
  ),
  port: z.array(PortName).optional().describe(
    'Ports to expose, defaults to all ports of the container',
  ),
})

export type Input = z.infer<typeof Input>

const shortUUIDtranslator = shortUUID.createTranslator(shortUUID.constants.uuid25Base36)

export default async function* (request: ServerRequest<Input>): ServerResponse<void> {
  const { ctx, input, signal } = request

  try {
    // First, try to find the deployment
    const deployment = await ctx.kube.client['karmada'].AppsV1.namespace(ctx.kube.namespace).getDeployment(input.name).catch(
      () => null,
    )

    let containerPorts: any[] = []

    if (deployment) {
      // Get ports from deployment template
      containerPorts = deployment.spec?.template?.spec?.containers?.[0]?.ports || []
    } else {
      // Fallback: try to find the pod directly (for backward compatibility)
      const pod = await ctx.kube.client['karmada'].CoreV1.namespace(ctx.kube.namespace).getPod(input.name).catch(() => {
        throw new Error(`Container ${input.name} not found`)
      })
      containerPorts = pod.spec?.containers?.[0]?.ports || []
    }

    if (containerPorts.length === 0) {
      throw new Error(`Container ${input.name} has no ports exposed`)
    }

    // If no ports is not specified, use all ports, if ports length === 0, remove all ports
    const routedPorts = (
      input.port === undefined
        ? containerPorts
        : input.port.length === 0
        ? []
        : containerPorts.filter((p) =>
          input.port!.includes(p.name ?? '') || input.port!.includes(p.containerPort.toString())
        )
    )
      .map((port) => ({
        name: port.name || `${port.containerPort}`,
        port: port.containerPort,
      }))

    if (routedPorts.length === 0) {
      throw new Error(`No ports found for container ${input.name} matching specified ports`)
    }

    const clusters = Object.entries(deployment?.metadata?.labels || {}).filter(([key, value]) =>
      key.startsWith('cluster.ctnr.io') && value === 'true'
    ).map(([key]) => key.split('/')[1]!)

    const userIdShort = shortUUIDtranslator.fromUUID(ctx.auth.user.id)
    const hostnames = [
      ...routedPorts.map((port) => [
        ...clusters.map((cluster) => `${port.name}-${input.name}-${userIdShort}.${cluster}.ctnr.io`),
        input.domain! && `${port.name}.${input.domain}`,
      ]),
    ].flat().filter(Boolean)

    // Check for domain ownership and create certificate if needed
    if (input.domain) {
      const rootDomain = input.domain.split('.').slice(-2).join('.')
      
      // Check if domain is already verified
      const alreadyVerified = await isDomainVerified(
        input.domain,
        ctx.auth.user.id,
        ctx.auth.user.createdAt
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
      
      // Create certificate if it doesn't exist
      const certificateName = input.domain.replace(/\./g, '-')
      const kubeClient = ctx.kube.client['karmada']
      
      try {
        await kubeClient.CertManagerV1(ctx.kube.namespace).getCertificate(certificateName)
        yield `SSL certificate for ${input.domain} already exists.`
      } catch (error: any) {
        if (error.status === 404) {
          yield `Creating SSL certificate for ${input.domain}...`
          yield* createDomainCertificate({
            domain: input.domain,
            userId: ctx.auth.user.id,
            namespace: ctx.kube.namespace,
            kubeClient,
            cluster: 'eu',
            ssl: true,
          })
        } else {
          throw error
        }
      }
    }

    await ensureUserRoute(ctx.kube.client['karmada'], ctx.kube.namespace, {
      hostnames,
      name: input.name,
      userId: ctx.auth.user.id,
      ports: routedPorts,
      clusters,
    }, signal)

    yield `Routes created successfully for container ${input.name}:`
    for (const hostname of hostnames) {
      yield `  - https://${hostname}`
    }
  } catch (error) {
    yield `Error creating route`
    throw error
  }
}
