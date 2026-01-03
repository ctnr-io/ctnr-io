import type { ObjectMeta } from './common.ts'

/**
 * Core Kubernetes Namespace
 */
export type Namespace = {
	apiVersion: 'v1'
	kind: 'Namespace'
	metadata: ObjectMeta
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
