import { z } from 'zod'

/**
 * Standard output formats supported across all resources
 */
export const OutputFormat = z.enum(['wide', 'name', 'json', 'yaml', 'raw'])
export type OutputFormat = z.infer<typeof OutputFormat>

/**
 * Pagination parameters for list operations
 */
export const Pagination = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
})
export type Pagination = z.infer<typeof Pagination>

/**
 * Generic paginated list response
 */
export interface ListResponse<T> {
  items: T[]
  nextCursor?: string
  total?: number
}

/**
 * Resource status common across different resource types
 */
export const ResourceStatus = z.enum([
  'running',
  'stopped',
  'pending',
  'error',
  'unknown',
  'creating',
  'deleting',
])
export type ResourceStatus = z.infer<typeof ResourceStatus>

/**
 * Common metadata present on all resources
 */
export const ResourceMetadata = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.date(),
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
})
export type ResourceMetadata = z.infer<typeof ResourceMetadata>

/**
 * Cluster identifiers
 */
export const ClusterNames = ['eu-0', 'eu-1', 'eu-2'] as const
export const ClusterName = z.enum(ClusterNames)
export type ClusterName = z.infer<typeof ClusterName>

export const ClusterOrKarmada = z.enum(['karmada', 'eu-0', 'eu-1', 'eu-2'])
export type ClusterOrKarmada = z.infer<typeof ClusterOrKarmada>

/**
 * Resource quantity helpers (CPU, Memory, Storage)
 */
export const CpuQuantity = z.string().regex(/^\d+m?$/, 'CPU must be in millicores (e.g., "250m") or cores (e.g., "1")')
export const MemoryQuantity = z.string().regex(/^\d+[KMGT]i?$/, 'Memory must be in Ki, Mi, Gi, or Ti')
export const StorageQuantity = z.string().regex(/^\d+[KMGT]i?$/, 'Storage must be in Ki, Mi, Gi, or Ti')

export const ResourceQuantities = z.object({
  cpu: CpuQuantity,
  memory: MemoryQuantity,
  storage: StorageQuantity.optional(),
})
export type ResourceQuantities = z.infer<typeof ResourceQuantities>
