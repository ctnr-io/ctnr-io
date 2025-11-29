import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { DomainRepository } from 'core/repositories/domain_repository.ts'
import type { Domain } from 'core/entities/network/domain.ts'

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

  const domainRepo = new DomainRepository(
    ctx.kube.client,
    ctx.project,
    ctx.auth.user.id,
    ctx.auth.user.createdAt,
  )

  try {
    // Get domains using repository
    const domains = await domainRepo.list({ name })

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
