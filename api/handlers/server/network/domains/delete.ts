import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { deleteDomain, DomainContext, domainExists } from 'core/data/network/domain.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string()
    .min(1, 'Domain name is required')
    .describe('Name of the domain to delete'),
  force: z.boolean()
    .optional()
    .default(false)
    .describe('Force delete even if domain is in use'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name, force: _force = false } = input

  const domainCtx: DomainContext = {
    kubeClient: ctx.kube.client.karmada,
    namespace: ctx.project.namespace,
    project: { id: ctx.project.id, cluster: ctx.project.cluster },
  }

  try {
    yield `Deleting domain ${name}...`

    // Check if domain exists
    const exists = await domainExists(domainCtx, name)
    if (!exists) {
      throw new Error(`Domain ${name} not found`)
    }

    await deleteDomain(domainCtx, name)

    yield `Domain ${name} has been successfully deleted`
    yield ``
    yield `Note: This removes the SSL certificate and domain configuration.`
    yield `You may also need to:`
    yield `1. Remove DNS records pointing to ctnr.io`
    yield `2. Cancel domain registration if no longer needed`
    yield `3. Routes associated with this domain have also been deleted`
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error deleting domain: ${errorMessage}`
    throw error
  }
}
