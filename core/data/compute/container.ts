import type { HTTPRoute, IngressRoute, KubeClient, PodMetrics } from 'infra/kubernetes/mod.ts'
import {
  ContainerInput,
  containerInputToPod,
  podToContainer,
  type TransformContainerOptions,
} from 'core/transform/container.ts'
import type { Container } from 'core/schemas/compute/container.ts'
import { deletePod, ensurePod } from 'infra/kubernetes/resources/core/pod.ts'
import { Pod } from 'infra/kubernetes/types/core.ts'

export interface ContainerContext {
  kubeClient: KubeClient
  namespace: string
}

/**
 * Create a container
 */
export async function createContainer(
  ctx: ContainerContext,
  container: ContainerInput,
  abortSignal: AbortSignal,
): Promise<Container> {
  // Build the pod using the transform function
  const podResource = containerInputToPod(container)

  await ensurePod(
    ctx.kubeClient,
    podResource,
    abortSignal,
  )

  return podToContainer(podResource)
}

/**
 * Delete a container (Pod) by name
 */
export async function deleteContainer(
  ctx: ContainerContext,
  name: string,
  abortSignal: AbortSignal,
): Promise<void> {
  const { kubeClient, namespace } = ctx

  // Patch pod ctnr.io/status
  await ensurePod(kubeClient, {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name,
      namespace,
      annotations: {
        'ctnr.io/desired-status': 'removing',
      },
    },
  }, abortSignal)

  // Delete Pod
  await Promise.all([
    deletePod(kubeClient, {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name,
        namespace,
      },
    }, abortSignal),
    waitForContainerPodDeletion({
      ctx,
      name,
      abortSignal,
    }),
  ])
}

/**
 * Stop a container
 */
export async function stopContainer(
  ctx: ContainerContext,
  name: string,
  signal: string,
  time: number | undefined,
  abortSignal: AbortSignal,
): Promise<void> {
  const { kubeClient, namespace } = ctx

  await Promise.race([
    // Send SIGSTOP to container PID 1
    kubeClient.CoreV1.namespace(namespace).tunnelPodExec(name, {
      command: ['kill', `-${signal}`, '1'],
      stdout: true,
      stderr: true,
      abortSignal,
    }),
    // Wait for specified time before force killing the container
    time === undefined ? undefined : (async () => {
      await new Promise((resolve) => setTimeout(resolve, (time ?? 30) * 1000))
      // After timeout, send SIGKILL if container is still running
      await kubeClient.CoreV1.namespace(namespace).tunnelPodExec(name, {
        command: ['kill', '-KILL', '1'],
        stdout: true,
        stderr: true,
        abortSignal,
      })
    }),
  ])
  
  const container = await getContainer(ctx, name)

  const newPod = containerInputToPod({
    ...container,
    namespace,
    desiredStatus: 'paused'
  })
  
  await ensurePod(
    kubeClient,
    newPod,
    abortSignal,
  )
}

/**
 * Start a container by ensuring its pod is running.
 */
export async function startContainer(
  ctx: ContainerContext,
  name: string,
  abortSignal: AbortSignal,
): Promise<void> {
  const { kubeClient, namespace } = ctx

  // Get pod
  const existingPod = await getContainerPod(ctx, name)
  // Normalize
  const container = podToContainer(existingPod!)
  const newPod = containerInputToPod({
    ...container,
    namespace,
    desiredStatus: 'running'
  })
  await ensurePod(kubeClient, newPod, abortSignal)
}

/**
 * Get the raw Kubernetes Pod
 */
export async function getContainerPod(
  ctx: ContainerContext,
  name: string,
): Promise<Pod> {
  const { kubeClient, namespace } = ctx
  try {
    return await kubeClient.CoreV1.namespace(namespace).getPod(name) as Pod
  } catch {
    throw new Error(`Container ${name} not found.`)
  }
}

/**
 * Watch pods in the namespace
 */
export function watchContainerPod(
  ctx: ContainerContext,
  options: { labelSelector?: string; abortSignal?: AbortSignal } = {},
) {
  const { kubeClient, namespace } = ctx
  return kubeClient.CoreV1.namespace(namespace).watchPodList({
    labelSelector: options.labelSelector ?? 'ctnr.io/name',
    abortSignal: options.abortSignal,
  })
}

export interface ListContainersOptions {
  name?: string
  includeMetrics?: boolean
  includeRoutes?: boolean
  abortSignal?: AbortSignal
}

/**
 * List all containers in the namespace with optional enrichment data
 */
export async function listContainers(
  ctx: ContainerContext,
  options: ListContainersOptions = {},
): Promise<Container[]> {
  const { kubeClient, namespace } = ctx
  const { name, includeMetrics, includeRoutes, abortSignal } = options

  // Fetch pods with optional name filter
  const podList = await kubeClient.CoreV1.namespace(namespace).getPodList({
    labelSelector: name ? `ctnr.io/name=${name}` : 'ctnr.io/name',
    abortSignal,
  }) as unknown as {
    items: Pod[]
  }

  // Prepare parallel fetches for optional data
  const [metrics, httpRoutes, ingressRoutes] = await Promise.all([
    includeMetrics
      ? kubeClient.MetricsV1Beta1(namespace).getPodsListMetrics({ abortSignal })
        .then((r) => r.items)
        .catch(() => [] as PodMetrics[])
      : Promise.resolve([] as PodMetrics[]),
    includeRoutes
      ? kubeClient.GatewayNetworkingV1(namespace).listHTTPRoutes({ abortSignal })
        // deno-lint-ignore no-explicit-any
        .then((r: any) => r.items ?? [])
        .catch(() => [] as HTTPRoute[])
      : Promise.resolve([] as HTTPRoute[]),
    includeRoutes
      ? kubeClient.TraefikV1Alpha1(namespace).listIngressRoutes({ abortSignal })
        .then((r) => r.items)
        .catch(() => [] as IngressRoute[])
      : Promise.resolve([] as IngressRoute[]),
  ])

  // Transform pods to containers
  return podList.items.map((pod) => {
    const podName = pod.metadata?.name ?? ''

    // Filter metrics for this deployment's pods
    const podsMetrics = metrics.filter((m: PodMetrics) => m.metadata?.name === podName)

    // Transform options
    const transformOptions: TransformContainerOptions = {
      metrics: podsMetrics.length > 0 ? podsMetrics : undefined,
      routes: includeRoutes ? { http: httpRoutes, ingress: ingressRoutes } : undefined,
    }

    return podToContainer(pod, transformOptions)
  })
}

export async function getContainer(
  ctx: ContainerContext,
  name: string,
  options: Omit<ListContainersOptions, 'name'> = {},
): Promise<Container> {
  const containers = await listContainers(ctx, { ...options, name })
  if (containers.length === 0) {
    throw new Error(`No such container: ${name}`)
  }
  return containers[0]
}

/**
 * Wait for Container to satisfy a condition
 */
export async function waitForContainer({ ctx, name, predicate, abortSignal }:  {
  ctx: ContainerContext
  name: string
  predicate: (container: Container) => boolean | Promise<boolean>
  abortSignal: AbortSignal
}): Promise<Container> {
  return podToContainer(await waitForContainerPod({
    ctx,
    name,
    predicate: pod => predicate(podToContainer(pod)),
    abortSignal
  }))
}

/**
 * Wait for a pod to satisfy a condition, with optional timeout for force killing
 */
export async function waitForContainerPod({ ctx, name, predicate, abortSignal }: {
  ctx: ContainerContext
  name: string
  predicate: (pod: Pod) => boolean | Promise<boolean>
  abortSignal: AbortSignal
}): Promise<Pod> {
  const podWatcher = await ctx.kubeClient.CoreV1.namespace(ctx.namespace)
    .watchPodList({
      labelSelector: `ctnr.io/name=${name}`,
      abortSignal,
    })
  const reader = podWatcher.getReader()
  while (true) {
    const { done, value } = await reader.read()
    const pod = value?.object as Pod
    if (pod?.metadata?.name === name && await predicate(pod)) {
      return pod
    }
    if (done) {
      return pod
    }
  }
}

/**
 * Wait for a pod to be deleted, with optional timeout for force killing
 */

export async function waitForContainerPodDeletion(
  { ctx, name, abortSignal }: { ctx: ContainerContext; name: string; abortSignal: AbortSignal },
): Promise<void> {
  const podWatcher = await ctx.kubeClient.CoreV1.namespace(ctx.namespace)
    .watchPodList({
      labelSelector: `ctnr.io/name=${name}`,
      abortSignal,
    })
  const reader = podWatcher.getReader()
  while (true) {
    const { done, value } = await reader.read()
    const pod = value?.object as Pod
    if (value?.type === 'DELETED' && pod?.metadata?.name === name) {
      console.debug(`Pod ${name} deleted`)
      break
    }
    if (done) {
      return
    }
  }
}
