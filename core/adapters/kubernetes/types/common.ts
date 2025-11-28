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
export interface ObjectMeta {
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
export interface LabelSelector {
  matchLabels?: Record<string, string>
  matchExpressions?: Array<{
    key: string
    operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'
    values?: string[]
  }>
}

/**
 * Kubernetes resource quantity (CPU, memory, storage)
 */
export type Quantity = string | { number: number; suffix: string }

/**
 * Resource requirements
 */
export interface ResourceRequirements {
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
