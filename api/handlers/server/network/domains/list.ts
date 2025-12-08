import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { listDomains as listDomainsData, type DomainContext } from 'core/data/network/domain.ts'
import type { Domain } from 'core/schemas/network/domain.ts'

export const Meta = {
  aliases: {
    options: {
      output: 'o',
    },
  },
}

export const Input = z.object({
  output: z.enum(['wide', 'name', 'json', 'yaml', 'raw']).optional(),
  name: z.string().optional(), // Filter by specific domain name
})

export type Input = z.infer<typeof Input>

type Output<Type extends 'raw' | 'json' | 'yaml' | 'name' | 'wide'> = {
  'raw': Domain[]
  'json': string
  'yaml': string
  'name': string
  'wide': void
}[Type]

export default async function* listDomains(
  { ctx, input }: ServerRequest<Input>,
): ServerResponse<Output<NonNullable<typeof input['output']>>> {
  const { output = 'raw', name } = input

  const domainCtx: DomainContext = {
    kubeClient: ctx.kube.client['karmada'],
    namespace: ctx.project.namespace,
    project: { id: ctx.project.id, cluster: ctx.project.cluster },
  }

  try {
    // Get domains using core/data
    const domains = await listDomainsData(domainCtx, { name })

    switch (output) {
      case 'raw':
        return domains

      case 'json':
        return JSON.stringify(domains, null, 2)

      case 'yaml':
        // Simple YAML output for domains
        return domains.map((domain) =>
          `name: ${domain.name}\n` +
          `status: ${domain.status}\n`
        ).join('')

      case 'name':
        return domains.map((domain) => domain.name).join('\n')

      case 'wide':
      default:
        // Header
        yield 'NAME'.padEnd(25) +
          'STATUS'.padEnd(12) +
          'VERIFICATION'.padEnd(12) +
          'AGE'

        // Domain rows
        for (const domain of domains) {
          const age = formatAge(domain.createdAt)

          yield domain.name.padEnd(25) +
            domain.status.padEnd(12) +
            (domain.verification?.status || 'unknown').padEnd(12) +
            age
        }
        return
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    yield `Error listing domains: ${errorMessage}`
    throw error
  }
}

function formatAge(createdAt: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - createdAt.getTime()

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}
