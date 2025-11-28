import { z } from 'zod'

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
  usedSize: z.string().optional(),
  
  // Status
  status: VolumeStatus,
  createdAt: z.date(),
  
  // Attachments
  attachedTo: z.array(z.string()),
  attachments: z.array(VolumeAttachment).optional(),
  
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
  cluster: z.enum(['eu-0', 'eu-1', 'eu-2']).optional(),
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
