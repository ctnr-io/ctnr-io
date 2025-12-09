import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { DomainContext, domainExists, ensureDomain, isDomainVerified } from 'core/data/network/domain.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  domain: z.string().regex(
    /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/,
    'Invalid domain name format (e.g., example.com)',
  ).min(1, 'Domain name is required').meta({ positional: true }),
})

export type Input = z.infer<typeof Input>

export default async function* handleCreateDomain(
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { domain: domainName } = input

  const domainCtx: DomainContext = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
    project: { id: ctx.project.id, cluster: ctx.project.cluster },
  }

  try {
    const domainExistsAlready = await domainExists(domainCtx, domainName)
    if (domainExistsAlready) {
      yield `ℹ️  Domain ${domainName} already exists in project ${ctx.project.id}.`
    }

    // Ensure domain anyway (registers in namespace annotations)
    const domain = await ensureDomain(domainCtx, domainName)

    // Check if domain is verified
    if (!await isDomainVerified(domainName, ctx.project.id)) {
      yield `🔑 Domain ${domainName} is not yet verified.`

      yield ``
      yield `👉 Please add the following DNS TXT record to your domain ${domain.rootDomain} to verify ownership: `
      yield ``

      if (domain.verification) {
        yield `Type: ${domain.verification.type}`
        yield `Name: ${domain.verification.name}`
        yield `Value: ${domain.verification.value}`
      }
      yield ``
      yield `Monitor the certificate status to track SSL provisioning progress.`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating domain: ${errorMessage}`
    throw error
  }
}
