import { z } from 'zod'

/**
 * Domain verification status
 */
export const DomainVerificationStatus = z.enum([
  'verified',
  'pending',
  'failed',
  'expired',
])
export type DomainVerificationStatus = z.infer<typeof DomainVerificationStatus>

/**
 * Domain status
 */
export const DomainStatus = z.enum([
  'active',
  'pending',
  'error',
  'inactive',
])
export type DomainStatus = z.infer<typeof DomainStatus>

/**
 * DNS record type
 */
export const DNSRecordType = z.enum([
  'A',
  'AAAA',
  'CNAME',
  'TXT',
  'MX',
  'NS',
])
export type DNSRecordType = z.infer<typeof DNSRecordType>

/**
 * DNS record
 */
export const DNSRecord = z.object({
  type: DNSRecordType,
  name: z.string(),
  value: z.string(),
  ttl: z.number().optional(),
  priority: z.number().optional(), // For MX records
})
export type DNSRecord = z.infer<typeof DNSRecord>

/**
 * Domain verification record
 */
export const DomainVerification = z.object({
  type: DNSRecordType,
  name: z.string(),
  value: z.string(),
  status: DomainVerificationStatus,
  verifiedAt: z.date().optional(),
  expiresAt: z.date().optional(),
})
export type DomainVerification = z.infer<typeof DomainVerification>

/**
 * Full domain DTO
 */
export const Domain = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  
  // Root domain info
  rootDomain: z.string(),
  subdomain: z.string().optional(),
  
  // Status
  status: DomainStatus,
  createdAt: z.date(),
  
  // Verification
  verification: DomainVerification.optional(),
  
  // DNS records
  records: z.array(DNSRecord).optional(),
  
  // Associated routes
  routes: z.array(z.string()).optional(),
  
  // Cluster info
  cluster: z.string().optional(),
  
  // Labels and annotations
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
})
export type Domain = z.infer<typeof Domain>

/**
 * Domain summary for list views
 */
export const DomainSummary = z.object({
  id: z.string(),
  name: z.string(),
  status: DomainStatus,
  verification: DomainVerificationStatus.optional(),
  routeCount: z.number(),
  createdAt: z.date(),
})
export type DomainSummary = z.infer<typeof DomainSummary>

/**
 * Create domain input
 */
export const CreateDomainInput = z.object({
  name: z.string().regex(/^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z]{2,})+$/),
  cluster: z.enum(['eu-0', 'eu-1', 'eu-2']).optional(),
})
export type CreateDomainInput = z.infer<typeof CreateDomainInput>
