import type { ObjectMeta } from './common.ts'

/**
 * Metrics API PodMetrics
 */
export type PodMetrics = {
  apiVersion: 'metrics.k8s.io/v1beta1'
  kind: 'PodMetrics'
  metadata: ObjectMeta & {
    creationTimestamp: string
  }
  timestamp: string
  window: string
  containers: ContainerMetrics[]
}

export type ContainerMetrics = {
  name: string
  usage: {
    cpu: string
    memory: string
  }
}

/**
 * Metrics API NodeMetrics
 */
export type NodeMetrics = {
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
