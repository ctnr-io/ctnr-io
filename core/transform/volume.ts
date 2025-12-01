/**
 * Volume Transformer
 * Converts Kubernetes PersistentVolumeClaim resources to Volume DTOs
 */
import type { PersistentVolumeClaim } from '@cloudydeno/kubernetes-apis/core/v1'
import type { Volume, VolumeAccessMode, VolumeStatus, VolumeSummary } from 'core/schemas/storage/volume.ts'
import { normalizeQuantity } from './resources.ts'

/**
 * Transform a Kubernetes PVC to a Volume DTO
 */
export function pvcToVolume(pvc: PersistentVolumeClaim): Volume {
  const metadata = pvc.metadata ?? {}
  const spec = pvc.spec ?? {}
  const status = pvc.status ?? {}
  const labels = metadata.labels ?? {}
  const annotations = metadata.annotations ?? {}

  // Extract size from resources request
  const sizeRequest = normalizeQuantity(spec.resources?.requests?.storage) || '0Gi'

  // Get mount path from annotations if available
  const mountPath = annotations['ctnr.io/mount-path'] || '/mnt/volume'

  // Get attached containers from labels (support comma-separated list)
  const attachedToLabel = labels['ctnr.io/attached-to'] || ''
  const attachedTo = attachedToLabel ? attachedToLabel.split(',').map((s) => s.trim()).filter(Boolean) : []

  return {
    id: metadata.uid || metadata.name || '',
    name: metadata.name || '',
    size: sizeRequest,
    usedSize: undefined, // Would need to query actual usage
    mountPath,
    status: mapPvcStatus(status.phase),
    createdAt: new Date(metadata.creationTimestamp || Date.now()),
    attachedTo,
    attachments: attachedTo.map((containerName) => ({
      containerName,
      mountPath,
      readOnly: false,
    })),
    accessMode: mapAccessMode(spec.accessModes?.[0]),
    storageClass: spec.storageClassName || 'default',
    cluster: labels['ctnr.io/cluster'],
    labels,
    annotations,
  }
}

/**
 * Transform a PVC to a VolumeSummary (lightweight)
 */
export function pvcToVolumeSummary(pvc: PersistentVolumeClaim): VolumeSummary {
  const metadata = pvc.metadata ?? {}
  const spec = pvc.spec ?? {}
  const status = pvc.status ?? {}
  const labels = metadata.labels ?? {}

  const attachedToLabel = labels['ctnr.io/attached-to'] || ''
  const attachedTo = attachedToLabel ? attachedToLabel.split(',').map((s) => s.trim()).filter(Boolean) : []

  return {
    id: metadata.uid || metadata.name || '',
    name: metadata.name || '',
    size: normalizeQuantity(spec.resources?.requests?.storage) || '0Gi',
    status: mapPvcStatus(status.phase),
    attachedTo,
    createdAt: new Date(metadata.creationTimestamp || Date.now()),
  }
}

/**
 * Map PVC phase to VolumeStatus
 */
export function mapPvcStatus(phase?: string | null): VolumeStatus {
  switch (phase) {
    case 'Bound':
      return 'bound'
    case 'Pending':
      return 'pending'
    case 'Available':
      return 'available'
    case 'Released':
      return 'released'
    case 'Failed':
      return 'error'
    default:
      return 'pending'
  }
}

/**
 * Map Kubernetes access mode to VolumeAccessMode
 */
export function mapAccessMode(accessMode?: string | null): VolumeAccessMode {
  switch (accessMode) {
    case 'ReadWriteOnce':
      return 'ReadWriteOnce'
    case 'ReadOnlyMany':
      return 'ReadOnlyMany'
    case 'ReadWriteMany':
      return 'ReadWriteMany'
    case 'ReadWriteOncePod':
      return 'ReadWriteOncePod'
    default:
      return 'ReadWriteOnce'
  }
}

/**
 * Create a PVC manifest from Volume creation input
 */
export function volumeInputToPvc(input: {
  name: string
  size: string
  accessMode?: VolumeAccessMode
  storageClass?: string
  mountPath?: string
  cluster?: string
}, namespace: string): PersistentVolumeClaim {
  return {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name: input.name,
      namespace,
      labels: {
        'ctnr.io/name': input.name,
        ...(input.cluster ? { 'ctnr.io/cluster': input.cluster } : {}),
      },
      annotations: {
        ...(input.mountPath ? { 'ctnr.io/mount-path': input.mountPath } : {}),
      },
    },
    spec: {
      accessModes: [input.accessMode ?? 'ReadWriteOnce'],
      storageClassName: input.storageClass ?? 'default',
      resources: {
        requests: {
          storage: input.size as unknown,
        } as Record<string, unknown>,
      },
    },
  } as unknown as PersistentVolumeClaim
}
