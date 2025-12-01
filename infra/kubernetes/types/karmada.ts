import type { LabelSelector, ObjectMeta } from './common.ts'

/**
 * Karmada PropagationPolicy
 */
export type PropagationPolicy = {
  apiVersion: 'policy.karmada.io/v1alpha1'
  kind: 'PropagationPolicy'
  metadata: ObjectMeta
  spec: {
    resourceSelectors: ResourceSelector[]
    placement: Placement
    propagateDeps?: boolean
    conflictResolution?: 'Overwrite' | 'Abort'
  }
}

/**
 * Karmada ClusterPropagationPolicy
 */
export type ClusterPropagationPolicy = {
  apiVersion: 'policy.karmada.io/v1alpha1'
  kind: 'ClusterPropagationPolicy'
  metadata: ObjectMeta
  spec: {
    resourceSelectors: ResourceSelector[]
    placement: Placement
    propagateDeps?: boolean
    conflictResolution?: 'Overwrite' | 'Abort'
  }
}

/**
 * Karmada FederatedResourceQuota
 */
export type FederatedResourceQuota = {
  apiVersion: 'policy.karmada.io/v1alpha1'
  kind: 'FederatedResourceQuota'
  metadata: ObjectMeta
  spec: {
    overall: Partial<
      Record<
        | 'cpu'
        | 'memory'
        | 'storage'
        | 'ephemeral-storage'
        | 'requests.cpu'
        | 'requests.memory'
        | 'requests.storage'
        | 'requests.ephemeral-storage'
        | 'limits.cpu'
        | 'limits.memory'
        | 'limits.ephemeral-storage',
        string
      >
    >
    staticWeight?: Array<{
      targetCluster: {
        clusterNames: string[]
      }
      weight: number
    }>
  }
  status?: {
    overall?: Record<string, string>
    aggregatedStatus?: Array<{
      clusterName: string
      resourceQuotaStatus: {
        hard?: Record<string, string>
        used?: Record<string, string>
      }
    }>
  }
}

/**
 * Resource selector for propagation policies
 */
export type ResourceSelector = {
  apiVersion?: string
  kind?: string
  name?: string
  namespace?: string
  labelSelector?: LabelSelector
}

/**
 * Placement configuration
 */
export type Placement = {
  clusterAffinity?: {
    clusterNames?: string[]
    exclude?: string[]
    labelSelector?: LabelSelector
  }
  clusterTolerations?: Array<{
    key: string
    operator: string
    value?: string
    effect?: string
  }>
  spreadConstraints?: Array<{
    spreadByField?: string
    spreadByLabel?: string
    maxGroups?: number
    minGroups?: number
  }>
  replicaScheduling?: {
    replicaSchedulingType?: 'Duplicated' | 'Divided'
    replicaDivisionPreference?: 'Weighted' | 'Aggregated'
    weightPreference?: {
      staticWeightList?: Array<{
        targetCluster: {
          clusterNames: string[]
        }
        weight: number
      }>
    }
  }
}
