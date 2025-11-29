import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { DomainRepository } from 'core/repositories/domain_repository.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string().regex(
    /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/,
    'Invalid domain name format (e.g., example.com)',
  ).min(1, 'Domain name is required'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name } = input

  const domainRepo = new DomainRepository(
    ctx.kube.client,
    ctx.project,
    ctx.auth.user.id,
    ctx.auth.user.createdAt,
  )

  try {
    // Check if domain already exists
    const exists = await domainRepo.exists(name)
    if (exists) {
      throw new Error(`Domain ${name} already exists`)
    }

    // Create domain (registers in namespace annotations)
    const domain = await domainRepo.create({ name })

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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating domain: ${errorMessage}`
    throw error
  }
}
