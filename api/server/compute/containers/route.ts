import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { ensureUserRoute } from 'lib/kubernetes/kube-client.ts'
import { hash } from 'node:crypto'
import * as shortUUID from '@opensrc/short-uuid'
import { resolveTxt } from 'node:dns/promises'
import { ContainerName, PortName } from 'lib/api/schemas.ts'
import checkUsage from 'api/server/billing/check_usage.ts'

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
    const deployment = await ctx.kube.client['eu'].AppsV1.namespace(ctx.kube.namespace).getDeployment(input.name).catch(
      () => null,
    )

    let containerPorts: any[] = []

    if (deployment) {
      // Get ports from deployment template
      containerPorts = deployment.spec?.template?.spec?.containers?.[0]?.ports || []
    } else {
      // Fallback: try to find the pod directly (for backward compatibility)
      const pod = await ctx.kube.client['eu'].CoreV1.namespace(ctx.kube.namespace).getPod(input.name).catch(() => {
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

    // TODO: ctnr domain add
    // Check for domain ownership, do this before adding HTTPRoute preventing user domain squatting
    if (input.domain) {
      const domain = input.domain.split('.').slice(-2).join('.')
      // Check that the user owns the domain
      const txtRecordName = `ctnr-io-ownership-${userIdShort}.${domain}`
      const txtRecordValue = hash('sha256', ctx.auth.user.createdAt.toString() + domain)
      const values = await resolveTxt(txtRecordName).catch(() => [])
      if (values.flat().includes(txtRecordValue)) {
        yield `Domain ownership for ${domain} already verified.`
      } else {
        // Check if the TXT record already exists
        yield [
          '',
          `Verifying domain ownership for ${domain}...`,
          '',
          'Please create a TXT record with the following details:',
          `Name: ${txtRecordName}`,
          `Value: ${txtRecordValue}`,
          '',
          '',
        ].join('\r\n')
        // Wait for the user to create the TXT record
        while (true) {
          yield `Checking for TXT record...`
          if (signal.aborted) {
            throw new Error('Domain ownership verification aborted')
          }
          // Check the TXT record every 5 seconds
          const values = await resolveTxt(txtRecordName).catch(() => [])
          if (values.flat().includes(txtRecordValue)) {
            yield 'TXT record verified successfully.'
            break
          }
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    }

    await ensureUserRoute(ctx.kube.client['eu'], ctx.kube.namespace, {
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
