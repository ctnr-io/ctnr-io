import { Container, ContainerStatus } from 'core/schemas/compute/container.ts'
import type { ObjectMeta } from './common.ts'
import { PodSpec, PodStatus, ResourceClaim } from '@cloudydeno/kubernetes-apis/core/v1'
import { Resource } from '../mod.ts'

/**
 * Core Kubernetes Namespace
 */
export type Namespace = {
  apiVersion: 'v1'
  kind: 'Namespace'
  metadata: ObjectMeta
}

/**
 * Core Kubernetes Pod
 */
export type Pod = {
  apiVersion: 'v1'
  kind: 'Pod'
  metadata: ObjectMeta & {
    labels?: Record<string, string> & {
      'ctnr.io/name'?: string
    }
    annotations?: Record<string, string> & {
      'ctnr.io/desired-status'?: ContainerStatus
      'ctnr.io/restart-policy'?: Container['restartPolicy']
      'kubernetes.io/ingress-bandwidth'?: string
      'kubernetes.io/egress-bandwidth'?: string
    }
  }
  spec?: PodSpec & {
    restartPolicy: 'Always' | 'OnFailure' | 'Never'
    containers: Array<
      Omit<PodSpec['containers'][number], 'resources'> & {
        resources: {
          claims: Array<ResourceClaim>
          limits: {
            cpu: string
            memory: string
            'ephemeral-storage': string
          }
          requests: {
            cpu: string
            memory: string
            'ephemeral-storage': string
          }
        }
      }
    >
  }
  status?: PodStatus
}

/**
 * Core Kubernetes Service
 */
export type Service = {
  apiVersion: 'v1'
  kind: 'Service'
  metadata: ObjectMeta
  spec: {
    selector?: Record<string, string>
    ports: Array<{
      protocol?: 'TCP' | 'UDP' | 'SCTP'
      port: number
      targetPort?: number | string
      nodePort?: number
    }>
    type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
    clusterIP?: string
    externalIPs?: string[]
    loadBalancerIP?: string
  }
}

/**
 * Core Kubernetes PersistentVolumeClaim
 */
export type PersistentVolumeClaim = {
  apiVersion: 'v1'
  kind: 'PersistentVolumeClaim'
  metadata: ObjectMeta
  spec: {
    accessModes: Array<'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod'>
    resources: {
      requests: {
        storage: string
      }
    }
    storageClassName?: string
    volumeMode?: 'Filesystem' | 'Block'
  }
}
