/**
 * Domain Repository
 * Provides data access for domain resources
 * 
 * Domains are stored as:
 * - Namespace annotations for domain verification status
 * - Certificates (cert-manager) for SSL provisioning
 * 
 * All operations go through Karmada (control plane)
 */
import type { Domain, DomainSummary, DomainStatus, DomainVerificationStatus } from 'core/entities/network/domain.ts'
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'
import type { Certificate } from 'core/adapters/kubernetes/types/cert-manager.ts'
import { getVerificationRecord } from 'core/adapters/dns/verification.ts'
import { BaseRepository, type ListOptions, type RepositoryProject, type KubeCluster } from './base_repository.ts'

export interface ListDomainsOptions extends ListOptions {
  status?: DomainStatus
}

export interface CreateDomainInput {
  name: string
}

/**
 * Repository for managing domain resources
 * 
 * Domains are tracked via namespace annotations and certificates
 */
export class DomainRepository extends BaseRepository<
  Domain,
  DomainSummary,
  CreateDomainInput,
  ListDomainsOptions
> {
  private userId: string
  private userCreatedAt: Date

  constructor(
    kubeClient: Record<KubeCluster, KubeClient>,
    project: RepositoryProject,
    userId: string,
    userCreatedAt: Date,
  ) {
    super(kubeClient, project)
    this.userId = userId
    this.userCreatedAt = userCreatedAt
  }

  /**
   * List all domains in the namespace
   */
  async list(options: ListDomainsOptions = {}): Promise<Domain[]> {
    const { name, status } = options

    // Get certificates (represent domains with SSL)
    const certificates = await this.fetchCertificates()

    // Transform to Domain DTOs
    let domains = certificates
      .filter((cert) => {
        // Only include certificates for external domains (not ctnr.io)
        const dnsNames = cert.spec?.dnsNames || []
        const commonName = cert.spec?.commonName
        const allNames = [...dnsNames, commonName].filter(Boolean)
        return allNames.some((n) => !n?.endsWith('.ctnr.io'))
      })
      .map((cert) => this.certificateToDomain(cert))

    // Apply filters
    if (name) {
      domains = domains.filter((d) => d.name === name || d.rootDomain === name)
    }
    if (status) {
      domains = domains.filter((d) => d.status === status)
    }

    return domains
  }

  /**
   * List domain summaries (lightweight)
   */
  async listSummaries(options: ListDomainsOptions = {}): Promise<DomainSummary[]> {
    const domains = await this.list(options)
    return domains.map((d) => this.domainToSummary(d))
  }

  /**
   * Get a single domain by name
   */
  async get(name: string): Promise<Domain | null> {
    const certificateName = this.domainToCertificateName(name)
    
    try {
      const cert = await this.karmada.CertManagerV1(this.namespace).getCertificate(certificateName)
      return this.certificateToDomain(cert as unknown as Certificate)
    } catch {
      return null
    }
  }

  /**
   * Check if a domain exists
   */
  async exists(name: string): Promise<boolean> {
    const domain = await this.get(name)
    return domain !== null
  }

  /**
   * Create/register a new domain
   * Returns the domain with verification instructions
   */
  async create(input: CreateDomainInput): Promise<Domain> {
    const { name } = input

    const rootDomain = this.getRootDomain(name)
    if (!rootDomain) {
      throw new Error('Invalid domain name format')
    }

    // Add domain to namespace annotations as pending
    const annotations = {
      [`domain.ctnr.io/${rootDomain}`]: 'pending' as const,
    }

    await this.karmada.CoreV1.patchNamespace(this.namespace, 'json-merge', {
      metadata: { annotations },
    })

    // Return domain with verification info
    const verificationRecord = getVerificationRecord(name, this.userId, this.userCreatedAt)

    return {
      id: rootDomain,
      name,
      rootDomain,
      subdomain: name === rootDomain ? undefined : name.replace(`.${rootDomain}`, ''),
      status: 'pending',
      createdAt: new Date(),
      verification: {
        type: verificationRecord.type as 'TXT',
        name: verificationRecord.name,
        value: verificationRecord.value,
        status: 'pending',
      },
    }
  }

  /**
   * Delete a domain
   */
  async delete(name: string): Promise<void> {
    const rootDomain = this.getRootDomain(name)
    const certificateName = this.domainToCertificateName(name)

    // Remove domain annotation from namespace (use empty string to indicate removal)
    if (rootDomain) {
      await this.karmada.CoreV1.patchNamespace(this.namespace, 'json-merge', {
        metadata: {
          annotations: {
            [`domain.ctnr.io/${rootDomain}`]: '',
          },
        },
      } as any)
    }

    // Delete certificate if exists
    try {
      await this.karmada.CertManagerV1(this.namespace).deleteCertificate(certificateName)
    } catch {
      // Certificate might not exist
    }
  }

  // Extended methods specific to domains

  /**
   * Get verification status for a domain
   */
  async getVerificationStatus(name: string): Promise<DomainVerificationStatus> {
    const rootDomain = this.getRootDomain(name)
    if (!rootDomain) {
      return 'failed'
    }

    try {
      const ns = await this.karmada.CoreV1.getNamespace(this.namespace)
      const status = ns.metadata?.annotations?.[`domain.ctnr.io/${rootDomain}`]
      
      if (status === 'verified') return 'verified'
      if (status === 'pending') return 'pending'
      if (status === 'failed') return 'failed'
      return 'pending'
    } catch {
      return 'failed'
    }
  }

  /**
   * Mark domain as verified
   */
  async markVerified(name: string): Promise<void> {
    const rootDomain = this.getRootDomain(name)
    if (!rootDomain) {
      throw new Error('Invalid domain name')
    }

    await this.karmada.CoreV1.patchNamespace(this.namespace, 'json-merge', {
      metadata: {
        annotations: {
          [`domain.ctnr.io/${rootDomain}`]: 'verified',
        },
      },
    })
  }

  /**
   * Get routes using this domain
   */
  async getRoutesUsingDomain(name: string): Promise<string[]> {
    try {
      const httpRoutesResponse = await this.karmada.GatewayNetworkingV1(this.namespace).listHTTPRoutes()
      const httpRoutes = httpRoutesResponse as unknown as { items: Array<{ metadata: { name: string }, spec?: { hostnames?: string[] } }> }
      
      return httpRoutes.items
        ?.filter((route) => {
          const hostnames = route.spec?.hostnames || []
          return hostnames.some((h: string) => h === name || h.endsWith(`.${name}`))
        })
        .map((route) => route.metadata.name) || []
    } catch {
      return []
    }
  }

  /**
   * Get domain count
   */
  async count(): Promise<number> {
    const domains = await this.list()
    return domains.length
  }

  // Private helper methods

  private async fetchCertificates(): Promise<Certificate[]> {
    try {
      const result = await this.karmada.CertManagerV1(this.namespace).getCertificatesList()
      return (result as unknown as { items: Certificate[] }).items ?? []
    } catch {
      return []
    }
  }

  private certificateToDomain(cert: Certificate): Domain {
    const metadata = cert.metadata || {}
    const spec = cert.spec || {}
    const status = cert.status || {}

    const dnsNames = spec.dnsNames || []
    const commonName = spec.commonName
    const allNames = [...dnsNames, commonName].filter(Boolean) as string[]
    const domainName = allNames.find((n) => !n?.endsWith('.ctnr.io')) || allNames[0] || ''
    const rootDomain = this.getRootDomain(domainName) || domainName

    // Determine status from certificate conditions
    const conditions = status.conditions || []
    const readyCondition = conditions.find((c) => c.type === 'Ready')
    const isReady = readyCondition?.status === 'True'
    const domainStatus: DomainStatus = isReady ? 'active' : 'pending'

    return {
      id: metadata.name || domainName,
      name: domainName,
      rootDomain,
      subdomain: domainName === rootDomain ? undefined : domainName.replace(`.${rootDomain}`, ''),
      status: domainStatus,
      createdAt: metadata.creationTimestamp ? new Date(metadata.creationTimestamp) : new Date(),
      verification: {
        type: 'TXT',
        name: `_ctnr-verify.${rootDomain}`,
        value: '', // Would need to be computed
        status: isReady ? 'verified' : 'pending',
        verifiedAt: isReady ? new Date() : undefined,
      },
      labels: metadata.labels,
      annotations: metadata.annotations,
    }
  }

  private domainToSummary(domain: Domain): DomainSummary {
    return {
      id: domain.id,
      name: domain.name,
      status: domain.status,
      verification: domain.verification?.status,
      routeCount: domain.routes?.length || 0,
      createdAt: domain.createdAt,
    }
  }

  private domainToCertificateName(name: string): string {
    return name.replace(/\./g, '-')
  }

  private getRootDomain(name: string): string | null {
    const match = name.split('.').slice(-2).join('.').match(
      /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/,
    )
    return match?.[0] || null
  }
}
