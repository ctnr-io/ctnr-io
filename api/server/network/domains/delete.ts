import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'

export const Meta = {
  aliases: {
    options: {},
  },
}

export const Input = z.object({
  name: z.string()
    .min(1, 'Domain name is required')
    .describe('Name of the domain to delete'),
  cluster: z.enum(['eu', 'eu-0', 'eu-1', 'eu-2'])
    .optional()
    .default('eu')
    .describe('Cluster where the domain exists'),
  force: z.boolean()
    .optional()
    .default(false)
    .describe('Force delete even if domain is in use'),
})

export type Input = z.infer<typeof Input>

export default async function* (
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<void> {
  const { name, cluster = 'eu', force = false } = input

  try {
    yield `Deleting domain ${name}...`

    // Get the Kubernetes client for the specified cluster
    const client = ctx.kube.client[cluster as keyof typeof ctx.kube.client]
    const certificateName = name.replace(/\./g, '-')

    // Check if certificate exists
    try {
      await client.CertManagerV1(ctx.kube.namespace).getCertificate(certificateName)
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Domain ${name} not found`)
      }
      throw error
    }

    // Check if domain is in use by any routes (unless force is true)
    if (!force) {
      // Check HTTPRoutes for usage
      try {
        const httpRoutesResponse = await client.GatewayNetworkingV1(ctx.kube.namespace).listHTTPRoutes()
        const httpRoutes = httpRoutesResponse as any
        const routesUsingDomain = httpRoutes.items?.filter((route: any) => {
          const hostnames = route.spec?.hostnames || []
          return hostnames.includes(name)
        }) || []

        if (routesUsingDomain.length > 0) {
          throw new Error(`Domain ${name} is currently in use by ${routesUsingDomain.length} route(s). Use --force to delete anyway.`)
        }
      } catch (error: any) {
        if (error.message.includes('in use')) {
          throw error
        }
        // If we can't check routes, warn but continue
        yield `Warning: Could not check for active routes using this domain.`
      }
    }

    // Perform the deletion
    yield `Removing certificate for ${name}...`
    
    await client.CertManagerV1(ctx.kube.namespace).deleteCertificate(certificateName)

    yield `Certificate for ${name} has been deleted`
    yield ``
    yield `Note: This removes the SSL certificate and domain configuration.`
    yield `You may also need to:`
    yield `1. Remove DNS records pointing to ctnr.io`
    yield `2. Update any routes that were using this domain`
    yield `3. Cancel domain registration if no longer needed`

    yield `Domain ${name} has been successfully deleted`

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error deleting domain: ${errorMessage}`
    throw error
  }
}