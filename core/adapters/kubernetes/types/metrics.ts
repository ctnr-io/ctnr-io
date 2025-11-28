import type { ObjectMeta } from './common.ts'

/**
 * Metrics API PodMetrics
 */
export interface PodMetrics {
  apiVersion: 'metrics.k8s.io/v1beta1'
  kind: 'PodMetrics'
  metadata: ObjectMeta & {
    creationTimestamp: string
  }
  timestamp: string
  window: string
  containers: ContainerMetrics[]
}

export interface ContainerMetrics {
  name: string
  usage: {
    cpu: string
    memory: string
  }
}

/**
 * Metrics API NodeMetrics
 */
export interface NodeMetrics {
  apiVersion: 'metrics.k8s.io/v1beta1'
  kind: 'NodeMetrics'
  metadata: ObjectMeta & {
    creationTimestamp: string
  }
  timestamp: string
  window: string
  usage: {
    cpu: string
    memory: string
  }
}
