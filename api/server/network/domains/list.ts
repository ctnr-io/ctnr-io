import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'

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

export interface Domain {
  id: string
  name: string
  status: 'active' | 'pending' | 'error' | 'expired'
  created: string
  verificationRecord: {
    type: string
    name: string
    value: string
  }
}

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

  try {
    // Get domains from Certificates only (external custom domains)
    const kubeClient = ctx.kube.client['eu']

    // Fetch only Certificates (these represent custom domains)
    const certificatesResult = await kubeClient.CertManagerV1(ctx.kube.namespace).getCertificatesList()
    const certificates = certificatesResult?.items || []

    // Transform Certificates to Domain format
    const domains: Domain[] = certificates
      .filter((cert: any) => {
        // Only include certificates that are for external domains (not ctnr.io subdomains)
        const dnsNames = cert.spec?.dnsNames || []
        const commonName = cert.spec?.commonName
        const allNames = [...dnsNames, commonName].filter(Boolean)
        return allNames.some((name: string) => !name?.endsWith('.ctnr.io'))
      })
      .map((cert: any) => {
        const metadata = cert.metadata || {}
        const spec = cert.spec || {}
        const status = cert.status || {}

        // Get the primary domain name (first external domain)
        const dnsNames = spec.dnsNames || []
        const commonName = spec.commonName
        const allNames = [...dnsNames, commonName].filter(Boolean)
        const domainName = allNames.find((name: string) => !name?.endsWith('.ctnr.io')) || allNames[0] || ''

        // Determine status from certificate conditions
        const conditions = status.conditions || []
        const readyCondition = conditions.find((c: any) => c.type === 'Ready')
        const isReady = readyCondition?.status === 'True'
        const domainStatus = isReady ? 'active' : 'pending'

        // Get additional info from labels/annotations
        const labels = metadata.labels || {}
        const annotations = metadata.annotations || {}

        return {
          id: metadata.uid || metadata.name || '',
          name: domainName,
          status: domainStatus as 'active' | 'pending' | 'error',
          created: String(metadata.creationTimestamp || new Date().toISOString()),
          verificationRecord: annotations['ctnr.io/verification-record'] || null,
        }
      })

    // Filter by name if specified
    const filteredDomains = name ? domains.filter((domain) => domain.name === name) : domains

    switch (output) {
      case 'raw':
        return filteredDomains

      case 'json':
        return JSON.stringify(filteredDomains, null, 2)

      case 'yaml':
        // Simple YAML output for domains
        return filteredDomains.map((domain) =>
          `name: ${domain.name}\n` +
          `status: ${domain.status}\n`
        ).join('')

      case 'name':
        return filteredDomains.map((domain) => domain.name).join('\n')

      case 'wide':
      default:
        // Header
        yield 'NAME'.padEnd(25) +
          'STATUS'.padEnd(12) +
          'AGE'

        // Domain rows
        for (const domain of filteredDomains) {
          const age = formatAge(domain.created)

          yield domain.name.padEnd(25) +
            domain.status.padEnd(12) +
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

function formatAge(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}
