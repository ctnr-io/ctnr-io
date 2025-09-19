import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { verifyDomainOwnership } from 'lib/domains/verification.ts'
import { createDomainCertificate } from 'lib/domains/certificate.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/, 'Invalid domain name format'),
  ssl: z.boolean().optional().default(true),
  provider: z.string().optional().describe('DNS provider for domain verification'),
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2']).optional(),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input, signal }: ServerRequest<Input>,
): ServerResponse<void> {
  const { 
    name, 
    ssl = true, 
    provider,
    cluster = 'eu'
  } = input

  try {
    // Only custom domains are supported (no subdomains)
    yield `Creating custom domain: ${name}`

    // Step 1: Verify domain ownership
    yield `Step 1: Verifying domain ownership...`
    yield* verifyDomainOwnership({
      domain: name,
      userId: ctx.auth.user.id,
      userCreatedAt: ctx.auth.user.createdAt,
      signal,
    })

    // Step 2: Create SSL certificate
    yield `Step 2: Creating SSL certificate...`
    const kubeClient = ctx.kube.client[cluster as keyof typeof ctx.kube.client]
    yield* createDomainCertificate({
      domain: name,
      userId: ctx.auth.user.id,
      namespace: ctx.kube.namespace,
      kubeClient,
      cluster,
      provider,
      ssl,
    })

    yield ``
    yield `✅ Domain ${name} created successfully!`
    yield ``
    yield `Next steps for custom domain setup:`
    yield `1. Add DNS records pointing to your ctnr.io cluster:`
    yield `   A/AAAA record: ${name} → [cluster-ip]`
    yield `2. Create routes to direct traffic to your containers:`
    yield `   ctnr route <container> --domain ${name}`
    if (ssl) {
      yield `3. SSL certificate will be automatically provisioned`
    }
    
    yield ``
    yield `Monitor the certificate status to track SSL provisioning progress.`

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `❌ Error creating domain: ${errorMessage}`
    throw error
  }
}
