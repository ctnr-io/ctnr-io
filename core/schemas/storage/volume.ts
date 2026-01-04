import { z } from 'zod'

/**
 * Volume size schema
 */
const VolumeSizeRegexp = /^(\d+)(?:G|Gi|GB|GiB)?$/
export const VolumeSize = z.string()
  .regex(VolumeSizeRegexp, 'Size must be in format like 10GB, 10G, 10GiB')
  .refine((value) => {
    const match = value.match(VolumeSizeRegexp)
    console.log('VolumeSize match:', match)
    if (!match) return false
    const size = parseInt(match[1], 10)
    return size >= 1 && size <= 20
  }, 'Currently volume size cannot exceed 20 GiB or be less than 1 GiB')
  .describe('Volume size')

/**
 * Volume mount schema
 */
const VolumeMountRegexp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?:\/[^:]*(:(\d+)(?:G|Gi|GB|GiB)?)?$/
export const VolumeMount = z.string()
  .regex(
    VolumeMountRegexp,
    'Volume format must be name:path or name:path:size (e.g., "data:/app/data", "data:/app/data:5G", "data:/app/data:5GB", or "data:/app/data:5GiB")',
  )
  .refine((value) => {
    const match = value.match(VolumeMountRegexp)
    if (!match || !match[3]) return true // Size is optional, so valid if not present
    const size = parseInt(match[3], 10)
    return size >= 1 && size <= 20
  }, 'Currently volume size cannot exceed 20 GiB or be less than 1 GiB')
  .describe('Volume mount in format name:path:size (size optional, defaults to 1G)')

/**
 * Volume access modes
 */
export const VolumeAccessMode = z.enum([
  'ReadWriteOnce',
  'ReadOnlyMany',
  'ReadWriteMany',
  'ReadWriteOncePod',
])
export type VolumeAccessMode = z.infer<typeof VolumeAccessMode>

/**
 * Volume status
 */
export const VolumeStatus = z.enum([
  'mounted',
  'available',
  'pending',
  'lost',
  'error',
  'bound',
  'released',
])
export type VolumeStatus = z.infer<typeof VolumeStatus>

/**
 * Volume attachment info
 */
export const VolumeAttachment = z.object({
  containerName: z.string(),
  mountPath: z.string(),
  readOnly: z.boolean().optional(),
})
export type VolumeAttachment = z.infer<typeof VolumeAttachment>

/**
 * Full volume DTO
 */
export const Volume = z.object({
  // Identity
  id: z.string(),
  name: z.string(),
  
  // Capacity
  size: z.string(),
  
  // Status
  status: VolumeStatus,
  createdAt: z.date(),
  
  // Storage configuration
  accessMode: VolumeAccessMode,
  storageClass: z.string(),
  
  // Labels and annotations
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
})
export type Volume = z.infer<typeof Volume>

/**
 * Volume summary for list views
 */
export const VolumeSummary = z.object({
  id: z.string(),
  name: z.string(),
  size: z.string(),
  status: VolumeStatus,
  attachedTo: z.array(z.string()),
  createdAt: z.date(),
})
export type VolumeSummary = z.infer<typeof VolumeSummary>

/**
 * Create volume input
 */
export const CreateVolumeInput = z.object({
  name: z.string().regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/).min(1).max(63),
  size: z.string().regex(/^\d+[KMGT]i?$/),
  accessMode: VolumeAccessMode.optional().default('ReadWriteOnce'),
  storageClass: z.string().optional().default('default'),
  mountPath: z.string().optional(),
  cluster: z.enum(['eu-1']).optional(),
})
export type CreateVolumeInput = z.infer<typeof CreateVolumeInput>

/**
 * Attach volume input
 */
export const AttachVolumeInput = z.object({
  volumeName: z.string(),
  containerName: z.string(),
  mountPath: z.string(),
  readOnly: z.boolean().optional().default(false),
})
export type AttachVolumeInput = z.infer<typeof AttachVolumeInput>
