/**
 * Volume Repository
 * Provides data access for volume resources (PVCs)
 * 
 * Uses Karmada for write operations (propagates to member clusters)
 * Uses project.cluster for read operations
 */
import type { PersistentVolumeClaim } from '@cloudydeno/kubernetes-apis/core/v1'
import { toQuantity } from '@cloudydeno/kubernetes-apis/common.ts'
import type { Volume, VolumeSummary, VolumeAccessMode } from 'core/entities/storage/volume.ts'
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'
import { pvcToVolume, pvcToVolumeSummary } from 'core/adapters/kubernetes/transform/volume.ts'
import { BaseRepository, type ListOptions, type RepositoryProject, type KubeCluster } from './base_repository.ts'

export interface ListVolumesOptions extends ListOptions {
  // Volume-specific options can be added here
}

export interface CreateVolumeInput {
  name: string
  size: string
  accessMode?: VolumeAccessMode
  storageClass?: string
  mountPath?: string
}

/**
 * Repository for managing volume resources
 * 
 * Write operations go through Karmada (propagates to member clusters)
 * Read operations go through project.cluster
 */
export class VolumeRepository extends BaseRepository<
  Volume,
  VolumeSummary,
  CreateVolumeInput,
  ListVolumesOptions
> {
  constructor(
    kubeClient: Record<KubeCluster, KubeClient>,
    project: RepositoryProject,
  ) {
    super(kubeClient, project)
  }

  /**
   * List all volumes in the namespace (reads from workload cluster)
   */
  async list(options: ListVolumesOptions = {}): Promise<Volume[]> {
    const { name, labelSelector } = options

    const pvcs = await this.workload.CoreV1.namespace(this.namespace).getPersistentVolumeClaimList({
      labelSelector: labelSelector ?? 'ctnr.io/name',
    })

    let filteredPvcs = pvcs.items
    if (name) {
      filteredPvcs = filteredPvcs.filter((pvc: PersistentVolumeClaim) => pvc.metadata?.name === name)
    }

    return filteredPvcs.map(pvcToVolume)
  }

  /**
   * List volume summaries (lightweight, reads from workload cluster)
   */
  async listSummaries(options: ListVolumesOptions = {}): Promise<VolumeSummary[]> {
    const { name, labelSelector } = options

    const pvcs = await this.workload.CoreV1.namespace(this.namespace).getPersistentVolumeClaimList({
      labelSelector: labelSelector ?? 'ctnr.io/name',
    })

    let filteredPvcs = pvcs.items
    if (name) {
      filteredPvcs = filteredPvcs.filter((pvc: PersistentVolumeClaim) => pvc.metadata?.name === name)
    }

    return filteredPvcs.map(pvcToVolumeSummary)
  }

  /**
   * Get a single volume by name (reads from workload cluster)
   */
  async get(name: string): Promise<Volume | null> {
    try {
      const pvc = await this.workload.CoreV1.namespace(this.namespace).getPersistentVolumeClaim(name)
      return pvcToVolume(pvc)
    } catch {
      return null
    }
  }

  /**
   * Check if a volume exists (reads from workload cluster)
   */
  async exists(name: string): Promise<boolean> {
    try {
      await this.workload.CoreV1.namespace(this.namespace).getPersistentVolumeClaim(name)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a new volume (writes to Karmada, propagates to clusters)
   */
  async create(input: CreateVolumeInput): Promise<Volume> {
    const { name, size, mountPath, accessMode = 'ReadWriteMany' } = input

    const pvcManifest: PersistentVolumeClaim = {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name,
        namespace: this.namespace,
        labels: {
          'ctnr.io/name': name,
          'ctnr.io/resource-type': 'volume',
        },
        annotations: mountPath ? {
          'ctnr.io/mount-path': mountPath,
        } : undefined,
      },
      spec: {
        accessModes: [accessMode],
        volumeMode: 'Block',
        resources: {
          requests: {
            storage: toQuantity(size),
          },
        },
      },
    }

    const created = await this.karmada.CoreV1.namespace(this.namespace).createPersistentVolumeClaim(pvcManifest)
    return pvcToVolume(created)
  }

  /**
   * Delete a volume by name (writes to Karmada, propagates to clusters)
   */
  async delete(name: string): Promise<void> {
    await this.karmada.CoreV1.namespace(this.namespace).deletePersistentVolumeClaim(name)
  }

  // Extended methods specific to volumes

  /**
   * Get the raw Kubernetes PVC (reads from workload cluster)
   */
  async getPvc(name: string): Promise<PersistentVolumeClaim | null> {
    try {
      return await this.workload.CoreV1.namespace(this.namespace).getPersistentVolumeClaim(name)
    } catch {
      return null
    }
  }

  /**
   * Update volume labels (writes to Karmada)
   */
  async updateLabels(name: string, labels: Record<string, string>): Promise<Volume> {
    const pvc = await this.karmada.CoreV1.namespace(this.namespace).getPersistentVolumeClaim(name)
    const updatedLabels = { ...pvc.metadata?.labels, ...labels }

    const patched = await this.karmada.CoreV1.namespace(this.namespace).patchPersistentVolumeClaim(name, 'strategic-merge', {
      metadata: { labels: updatedLabels },
    })

    return pvcToVolume(patched)
  }

  /**
   * Get volume count (reads from workload cluster)
   */
  async count(): Promise<number> {
    const pvcs = await this.workload.CoreV1.namespace(this.namespace).getPersistentVolumeClaimList({
      labelSelector: 'ctnr.io/name',
    })
    return pvcs.items.length
  }

  /**
   * Check if volume is attached to any container (reads from workload cluster)
   */
  async getAttachedContainer(name: string): Promise<string | null> {
    const pvc = await this.getPvc(name)
    return pvc?.metadata?.labels?.['ctnr.io/attached-to'] ?? null
  }

  /**
   * Get pods using this volume (reads from workload cluster)
   */
  async getPodsUsingVolume(volumeName: string): Promise<string[]> {
    const podList = await this.workload.CoreV1.namespace(this.namespace).getPodList()
    const podsUsingVolume = podList.items.filter((pod) => {
      const volumes = pod.spec?.volumes || []
      return volumes.some((volume) => volume.persistentVolumeClaim?.claimName === volumeName)
    })
    return podsUsingVolume.map((pod) => pod.metadata?.name).filter((name): name is string => !!name)
  }

  /**
   * Wait for volume to be deleted (reads from workload cluster)
   */
  async waitForDeletion(name: string, timeoutSeconds: number = 30): Promise<boolean> {
    let attempts = 0
    while (attempts < timeoutSeconds) {
      const exists = await this.exists(name)
      if (!exists) {
        return true
      }
      attempts++
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return false
  }

  /**
   * Wait for volume to be bound and ready (reads from workload cluster)
   */
  async waitForReady(name: string, timeoutSeconds: number = 30): Promise<'Bound' | 'Failed' | null> {
    let attempts = 0
    while (attempts < timeoutSeconds) {
      const pvc = await this.getPvc(name)
      if (!pvc) {
        throw new Error(`Volume ${name} not found`)
      }

      if (pvc.status?.phase === 'Bound') {
        return 'Bound'
      }

      if (pvc.status?.phase === 'Failed') {
        return 'Failed'
      }

      attempts++
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return null
  }
}
