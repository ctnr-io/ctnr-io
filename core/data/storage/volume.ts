import { PersistentVolumeClaim } from '@cloudydeno/kubernetes-apis/core/v1'
import { toQuantity } from '@cloudydeno/kubernetes-apis/common.ts'
import { KubeClient } from 'infra/kubernetes/mod.ts'
import type { Volume, VolumeStatus } from 'core/schemas/storage/volume.ts'

export interface CreateVolumeOptions {
  name: string
  size: string
  namespace: string
  kubeClient: KubeClient
}

/**
 * Create a PersistentVolumeClaim for a volume
 */
export async function* ensureVolume(
  options: CreateVolumeOptions,
): AsyncGenerator<string, PersistentVolumeClaim> {
  const {
    name,
    size,
    namespace,
    kubeClient,
  } = options

  // Check if volume already exists
  try {
    const pvc = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)
    yield `Volume ${name} already exists`
    return pvc
  } catch {
    // Volume doesn't exist, proceed with creation
  }

  yield `Creating volume ${name} with size ${size}...`

  // Check that volume is in same cluster

  // Create PersistentVolumeClaim manifest
  const pvcManifest: PersistentVolumeClaim = {
    apiVersion: 'v1' as const,
    kind: 'PersistentVolumeClaim' as const,
    metadata: {
      name,
      namespace,
      labels: {
        'ctnr.io/resource-type': 'volume',
      },
    },
    spec: {
      accessModes: ['ReadWriteMany'],
      volumeMode: 'Block',
      resources: {
        requests: {
          storage: toQuantity(size),
        },
      },
    },
  }
  await kubeClient.CoreV1.namespace(namespace).createPersistentVolumeClaim(pvcManifest)

  // Create the PersistentVolumeClaim
  yield `Volume ${name} created successfully`
  yield `  Size: ${size}`

  return pvcManifest
}

/**
 * Wait for a volume to be bound and ready
 */
export async function* waitForVolumeReady(
  name: string,
  namespace: string,
  kubeClient: KubeClient,
  timeoutSeconds: number = 30,
): AsyncGenerator<string, boolean> {
  yield `Waiting for volume ${name} to be provisioned...`

  let attempts = 0
  const maxAttempts = timeoutSeconds

  while (attempts < maxAttempts) {
    const pvc = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)

    if (pvc.status?.phase === 'Bound') {
      yield `Volume ${name} is now available and ready to use`
      return true
    }

    if (pvc.status?.phase === 'Failed') {
      throw new Error(`Volume provisioning failed: Unknown error`)
    }

    attempts++
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  yield `Volume ${name} created but still provisioning. This may take a few more moments.`
  return false
}

/**
 * Check if a volume exists
 */
export async function isVolumeExists(
  name: string,
  namespace: string,
  kubeClient: KubeClient,
): Promise<boolean> {
  try {
    await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)
    return true
  } catch (error: any) {
    if (error.status === 404) {
      return false
    }
    throw error
  }
}

/**
 * Delete a volume (PersistentVolumeClaim)
 */
export async function* deleteVolume(
  name: string,
  namespace: string,
  kubeClient: KubeClient,
): AsyncGenerator<string, boolean> {
  try {
    // Check if volume exists
    await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)
  } catch (error: any) {
    if (error.status === 404) {
      yield `Volume ${name} not found`
      return false
    }
    throw error
  }

  yield `Deleting volume ${name}...`

  // Delete the PersistentVolumeClaim
  await kubeClient.CoreV1.namespace(namespace).deletePersistentVolumeClaim(name)

  yield `Volume ${name} deleted successfully`
  return true
}

/**
 * Get volume information
 */
export async function getVolumeInfo(
  name: string,
  namespace: string,
  kubeClient: KubeClient,
): Promise<{
  name: string
  size: string
  phase: string
  storageClass: string | undefined
  createdAt: Date | undefined
}> {
  const pvc = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)

  return {
    name: pvc.metadata?.name || name,
    size: pvc.spec?.resources?.requests?.storage?.serialize() || 'Unknown',
    phase: pvc.status?.phase || 'Unknown',
    storageClass: pvc.spec?.storageClassName || undefined,
    createdAt: pvc.metadata?.creationTimestamp ? new Date(pvc.metadata.creationTimestamp) : undefined,
  }
}

export interface VolumeContext {
  kubeClient: KubeClient
  namespace: string
}

export interface ListVolumesOptions {
  name?: string
  signal?: AbortSignal
}

/**
 * List all volumes in the namespace
 */
export async function listVolumes(
  ctx: VolumeContext,
  options: ListVolumesOptions = {}
): Promise<Volume[]> {
  const { kubeClient, namespace } = ctx
  const { name: filterName, signal } = options

  const pvcList = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaimList({
    labelSelector: 'ctnr.io/resource-type=volume',
    abortSignal: signal,
  })

  return pvcList.items
    .filter((pvc) => !filterName || pvc.metadata?.name === filterName)
    .map((pvc): Volume => {
      const metadata = pvc.metadata ?? {}
      const spec = pvc.spec ?? {}
      const status = pvc.status ?? {}

      console.log(pvc)
      // Map PVC phase to VolumeStatus
      const phaseToStatus: Record<string, VolumeStatus> = {
        'Bound': 'bound',
        'Pending': 'pending',
        'Lost': 'lost',
        'Available': 'available',
      }
      const volumeStatus: VolumeStatus = phaseToStatus[status.phase ?? ''] ?? 'pending'

      return {
        id: metadata.uid ?? metadata.name ?? '',
        name: metadata.name ?? '',
        size: spec.resources?.requests?.storage?.serialize() ?? 'Unknown',
        status: volumeStatus,
        createdAt: metadata.creationTimestamp
          ? new Date(metadata.creationTimestamp)
          : new Date(),
        attachedTo: [], // TODO: Get attached containers from pod volumeMounts
        storageClass: spec.storageClassName ?? 'default',
        accessMode: (spec.accessModes?.[0] as 'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod') ?? 'ReadWriteOnce',
        labels: metadata.labels ?? {},
        annotations: metadata.annotations ?? {},
      }
    })
}
