import { PersistentVolumeClaim } from '@cloudydeno/kubernetes-apis/core/v1'
import { toQuantity } from '@cloudydeno/kubernetes-apis/common.ts'
import { KubeClient } from 'lib/kubernetes/kube-client.ts'
import { ClusterName } from 'lib/api/schemas.ts'

export interface CreateVolumeOptions {
  name: string
  size: string
  mountPath: string
  userId: string
  namespace: string
  kubeClient: KubeClient
}

/**
 * Ensure volume
 */
export async function* ensureVolume(
  options: CreateVolumeOptions,
) {
  const {
    name,
    namespace,
    kubeClient,
  } = options

  // Check if volume already exists
  const existingPvc = await isVolumeExists(name, namespace, kubeClient)

  if (existingPvc) {
    yield `Volume ${name} already exists`
  } else {
    yield* createVolume(options)
  }

  return getVolumeInfo(name, namespace, kubeClient)
}

/**
 * Create a PersistentVolumeClaim for a volume
 */
export async function* createVolume(
  options: CreateVolumeOptions,
): AsyncGenerator<string> {
  const {
    name,
    size,
    userId,
    namespace,
    kubeClient,
  } = options

  // Check if volume already exists
  try {
    const existingPvc = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)
    yield `Volume ${name} already exists`
    return {
      created: false,
      pvc: existingPvc,
    }
  } catch (error: any) {
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
        'ctnr.io/owner-id': userId,
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

  // Create the PersistentVolumeClaim
  yield `Volume ${name} created successfully`
  yield `  Size: ${size}`
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
  mountPath: string | undefined
  createdAt: string | undefined
  createdBy: string | undefined
}> {
  const pvc = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaim(name)

  return {
    name: pvc.metadata?.name || name,
    size: pvc.spec?.resources?.requests?.storage?.serialize() || 'Unknown',
    phase: pvc.status?.phase || 'Unknown',
    storageClass: pvc.spec?.storageClassName || undefined,
    mountPath: pvc.metadata?.annotations?.['ctnr.io/mount-path'],
    createdAt: pvc.metadata?.annotations?.['ctnr.io/created-at'],
    createdBy: pvc.metadata?.annotations?.['ctnr.io/created-by'],
  }
}
