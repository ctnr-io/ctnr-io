import type { KubeClient } from 'infra/kubernetes/mod.ts'
import { getVerificationRecord } from '../../../infra/dns/mod.ts'
import type { Domain, DomainStatus, DomainVerificationStatus } from 'core/schemas/network/domain.ts'

export interface DomainContext {
  kubeClient: KubeClient
  namespace: string
  userId: string
  userCreatedAt: Date
}

export interface DomainVerification {
  type: 'TXT'
  name: string
  value: string
}

export interface EnsureDomainResult {
  name: string
  rootDomain: string
  verification: DomainVerification
}

/**
 * Get root domain from a domain name
 */
export function getRootDomain(name: string): string | null {
  const parts = name.split('.')
  if (parts.length < 2) return null
  const rootDomain = parts.slice(-2).join('.')
  const match = rootDomain.match(
    /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/,
  )
  return match?.[0] || null
}

/**
 * Ensure a domain is registered (add to namespace annotations)
 */
export async function ensureDomain(
  ctx: DomainContext,
  name: string
): Promise<EnsureDomainResult> {
  const { kubeClient, namespace, userId, userCreatedAt } = ctx

  const rootDomain = getRootDomain(name)
  if (!rootDomain) {
    throw new Error('Invalid domain name format')
  }

  // Add domain to namespace annotations as pending
  await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
    metadata: {
      annotations: {
        [`domain.ctnr.io/${rootDomain}`]: 'pending',
      },
    },
  })

  // Get verification record
  const verificationRecord = getVerificationRecord(name, userId, userCreatedAt)

  return {
    name,
    rootDomain,
    verification: {
      type: verificationRecord.type as 'TXT',
      name: verificationRecord.name,
      value: verificationRecord.value,
    },
  }
}

/**
 * Delete a domain (remove from namespace annotations and delete certificate)
 */
export async function deleteDomain(
  ctx: DomainContext,
  name: string
): Promise<void> {
  const { kubeClient, namespace } = ctx

  const rootDomain = getRootDomain(name)
  const certificateName = name.replace(/\./g, '-')

  // Remove domain annotation from namespace
  if (rootDomain) {
    await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
      metadata: {
        annotations: {
          [`domain.ctnr.io/${rootDomain}`]: null,
        },
      },
    } as any)
  }

  // Delete certificate if exists
  try {
    await kubeClient.CertManagerV1(namespace).deleteCertificate(certificateName)
  } catch {
    // Certificate might not exist
  }
}

/**
 * Check if a domain exists
 */
export async function domainExists(
  ctx: DomainContext,
  name: string
): Promise<boolean> {
  const { kubeClient, namespace } = ctx

  const rootDomain = getRootDomain(name)
  if (!rootDomain) return false

  try {
    const ns = await kubeClient.CoreV1.getNamespace(namespace)
    const status = ns.metadata?.annotations?.[`domain.ctnr.io/${rootDomain}`]
    return status !== undefined && status !== null && status !== ''
  } catch {
    return false
  }
}

/**
 * Mark domain as verified
 */
export async function markDomainVerified(
  ctx: DomainContext,
  name: string
): Promise<void> {
  const { kubeClient, namespace } = ctx

  const rootDomain = getRootDomain(name)
  if (!rootDomain) {
    throw new Error('Invalid domain name')
  }

  await kubeClient.CoreV1.patchNamespace(namespace, 'json-merge', {
    metadata: {
      annotations: {
        [`domain.ctnr.io/${rootDomain}`]: 'verified',
      },
    },
  })
}

/**
 * Get domain verification status
 */
export async function getDomainVerificationStatus(
  ctx: DomainContext,
  name: string
): Promise<'verified' | 'pending' | 'failed'> {
  const { kubeClient, namespace } = ctx

  const rootDomain = getRootDomain(name)
  if (!rootDomain) return 'failed'

  try {
    const ns = await kubeClient.CoreV1.getNamespace(namespace)
    const status = ns.metadata?.annotations?.[`domain.ctnr.io/${rootDomain}`]
    
    if (status === 'verified') return 'verified'
    if (status === 'pending') return 'pending'
    return 'failed'
  } catch {
    return 'failed'
  }
}

export interface ListDomainsOptions {
  name?: string
  signal?: AbortSignal
}

/**
 * List all domains from namespace annotations
 */
export async function listDomains(
  ctx: DomainContext,
  options: ListDomainsOptions = {}
): Promise<Domain[]> {
  const { kubeClient, namespace, userId, userCreatedAt } = ctx
  const { name: filterName } = options

  try {
    const ns = await kubeClient.CoreV1.getNamespace(namespace)
    const annotations = ns.metadata?.annotations ?? {}
    
    const domains: Domain[] = []
    
    for (const [key, value] of Object.entries(annotations)) {
      // Match domain.ctnr.io/* annotations
      const match = key.match(/^domain\.ctnr\.io\/(.+)$/)
      if (!match) continue
      
      const rootDomain = match[1]
      if (!rootDomain) continue
      
      // Apply name filter
      if (filterName && rootDomain !== filterName) continue
      
      // Map annotation value to status
      const status: DomainStatus = value === 'verified' ? 'active' : 
                                   value === 'pending' ? 'pending' : 'error'
      
      const verificationStatus: DomainVerificationStatus = 
        value === 'verified' ? 'verified' : 
        value === 'pending' ? 'pending' : 'failed'
      
      // Get verification record
      const verificationRecord = getVerificationRecord(rootDomain, userId, userCreatedAt)
      
      domains.push({
        id: `${namespace}/${rootDomain}`,
        name: rootDomain,
        rootDomain,
        status,
        createdAt: ns.metadata?.creationTimestamp 
          ? new Date(ns.metadata.creationTimestamp) 
          : new Date(),
        verification: {
          type: verificationRecord.type as 'TXT',
          name: verificationRecord.name,
          value: verificationRecord.value,
          status: verificationStatus,
        },
      })
    }
    
    return domains
  } catch {
    return []
  }
}
