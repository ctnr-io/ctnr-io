import type { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import type { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import type { PodMetrics, HTTPRoute, IngressRoute, KubeClient } from 'infra/kubernetes/mod.ts'
import { deploymentToContainer, type TransformContainerOptions } from 'core/transform/container.ts'
import type { Container } from 'core/schemas/compute/container.ts'

export interface ContainerContext {
	kubeClient: KubeClient
	namespace: string
}

/**
 * Delete a container (Deployment) by name
 */
export async function deleteContainer(
	ctx: ContainerContext,
	name: string,
	signal?: AbortSignal,
): Promise<void> {
	const { kubeClient, namespace } = ctx
	await kubeClient.AppsV1.namespace(namespace).deleteDeployment(name, {
		abortSignal: signal,
	})
}

/**
 * Stop a container (set replicas to 0 and remove HPA)
 */
export async function stopContainer(
	ctx: ContainerContext,
	name: string,
	signal?: AbortSignal,
): Promise<void> {
	const { kubeClient, namespace } = ctx

	// Set replicas to 0
	await kubeClient.AppsV1.namespace(namespace).patchDeployment(name, 'json-merge', {
		spec: { replicas: 0, template: {}, selector: {} },
	})

	// Delete HPA if exists
	await kubeClient.AutoScalingV2Api.namespace(namespace).deleteHorizontalPodAutoscaler(name, {
		abortSignal: signal,
	}).catch(() => {})
}

/**
 * Scale a container to specified replicas
 */
export async function scaleContainer(
	ctx: ContainerContext,
	name: string,
	replicas: number,
): Promise<void> {
	const { kubeClient, namespace } = ctx
	await kubeClient.AppsV1.namespace(namespace).patchDeployment(name, 'json-merge', {
		spec: { replicas, template: {}, selector: {} },
	})
}

/**
 * Delete all pods for a container
 */
export async function deleteContainerPods(
	ctx: ContainerContext,
	name: string,
	signal?: AbortSignal,
): Promise<void> {
	const { kubeClient, namespace } = ctx
	await kubeClient.CoreV1.namespace(namespace).deletePodList({
		labelSelector: `ctnr.io/name=${name}`,
		abortSignal: signal,
	})
}

/**
 * Check if a container exists
 */
export async function containerExists(
	ctx: ContainerContext,
	name: string,
): Promise<boolean> {
	const { kubeClient, namespace } = ctx
	try {
		await kubeClient.AppsV1.namespace(namespace).getDeployment(name)
		return true
	} catch {
		return false
	}
}

/**
 * Get the raw Kubernetes Deployment
 */
export async function getDeployment(
	ctx: ContainerContext,
	name: string,
): Promise<Deployment | null> {
	const { kubeClient, namespace } = ctx
	try {
		return await kubeClient.AppsV1.namespace(namespace).getDeployment(name)
	} catch {
		return null
	}
}

/**
 * Watch deployments in the namespace
 */
export function watchDeployments(
	ctx: ContainerContext,
	options: { labelSelector?: string; signal?: AbortSignal } = {},
) {
	const { kubeClient, namespace } = ctx
	return kubeClient.AppsV1.namespace(namespace).watchDeploymentList({
		labelSelector: options.labelSelector ?? 'ctnr.io/name',
		abortSignal: options.signal,
	})
}

export interface ListContainersOptions {
	name?: string
	includeMetrics?: boolean
	includeRoutes?: boolean
	includePods?: boolean
	signal?: AbortSignal
}

/**
 * List all containers in the namespace with optional enrichment data
 */
export async function listContainers(
	ctx: ContainerContext,
	options: ListContainersOptions = {},
): Promise<Container[]> {
	const { kubeClient, namespace } = ctx
	const { name, includeMetrics, includeRoutes, includePods, signal } = options

	// Fetch deployments with optional name filter
	const deploymentList = await kubeClient.AppsV1.namespace(namespace).getDeploymentList({
		labelSelector: name ? `ctnr.io/name=${name}` : 'ctnr.io/name',
		abortSignal: signal,
	})

	// Prepare parallel fetches for optional data
	const [pods, metrics, httpRoutes, ingressRoutes] = await Promise.all([
		includePods
			? kubeClient.CoreV1.namespace(namespace).getPodList({ abortSignal: signal }).then((r) => r.items)
			: Promise.resolve([] as Pod[]),
		includeMetrics
			? kubeClient.MetricsV1Beta1(namespace).getPodsListMetrics({ abortSignal: signal })
				.then((r) => r.items)
				.catch(() => [] as PodMetrics[])
			: Promise.resolve([] as PodMetrics[]),
		includeRoutes
			? kubeClient.GatewayNetworkingV1(namespace).listHTTPRoutes({ abortSignal: signal })
				// deno-lint-ignore no-explicit-any
				.then((r: any) => r.items ?? [])
				.catch(() => [] as HTTPRoute[])
			: Promise.resolve([] as HTTPRoute[]),
		includeRoutes
			? kubeClient.TraefikV1Alpha1(namespace).listIngressRoutes({ abortSignal: signal })
				.then((r) => r.items)
				.catch(() => [] as IngressRoute[])
			: Promise.resolve([] as IngressRoute[]),
	])

	// Transform deployments to containers
	return deploymentList.items.map((deployment) => {
		const deploymentName = deployment.metadata?.name ?? ''

		// Filter pods for this deployment
		const deploymentPods = pods.filter((pod: Pod) =>
			pod.metadata?.labels?.['ctnr.io/name'] === deploymentName
		)

		// Filter metrics for this deployment's pods
		const podNames = new Set(deploymentPods.map((p: Pod) => p.metadata?.name))
		const deploymentMetrics = metrics.filter((m: PodMetrics) => podNames.has(m.metadata?.name))

		// Transform options
		const transformOptions: TransformContainerOptions = {
			pods: deploymentPods.length > 0 ? deploymentPods : undefined,
			metrics: deploymentMetrics.length > 0 ? deploymentMetrics : undefined,
			routes: includeRoutes
				? { http: httpRoutes, ingress: ingressRoutes }
				: undefined,
		}

		return deploymentToContainer(deployment, transformOptions)
	})
}
