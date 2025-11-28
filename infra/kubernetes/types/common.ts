import { Quantity } from '@cloudydeno/kubernetes-apis/common.ts'

/**
 * Generic Kubernetes list response
 */
export type List<T> = {
  apiVersion: string
  kind: string
  metadata: {
    resourceVersion?: string
    continue?: string
  }
  items: T[]
}

/**
 * Common Kubernetes metadata
 */
export type ObjectMeta = {
  name: string
  namespace?: string
  uid?: string
  resourceVersion?: string
  creationTimestamp?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
}

/**
 * Kubernetes label selector
 */
export type LabelSelector = {
  matchLabels?: Record<string, string>
  matchExpressions?: Array<{
    key: string
    operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'
    values?: string[]
  }>
}

/**
 * Resource requirements
 */
export type ResourceRequirements = {
  limits?: {
    cpu?: Quantity
    memory?: Quantity
    'ephemeral-storage'?: Quantity
  }
  requests?: {
    cpu?: Quantity
    memory?: Quantity
    'ephemeral-storage'?: Quantity
  }
}
