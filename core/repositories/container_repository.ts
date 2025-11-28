/**
 * Container Repository
 * Provides data access for container resources
 * 
 * Uses Karmada for write operations (propagates to member clusters)
 * Uses project.cluster for read operations on sub-resources (pods, metrics)
 */
import type { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'
import type { Pod } from '@cloudydeno/kubernetes-apis/core/v1'
import type { Container, ContainerSummary } from 'core/entities/compute/container.ts'
import type { PodMetrics } from 'core/adapters/kubernetes/types/metrics.ts'
import type { HTTPRoute } from 'core/adapters/kubernetes/types/gateway.ts'
import type { IngressRoute } from 'core/adapters/kubernetes/types/traefik.ts'
import { deploymentToContainer, deploymentToContainerSummary } from 'core/adapters/kubernetes/transform/container.ts'
import { BaseRepository, type ListOptions, type RepositoryProject } from './base_repository.ts'
import type { KubeCluster } from './base_repository.ts'
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'

export type { RepositoryProject as Project }

export interface ListContainersOptions extends ListOptions {
  includeMetrics?: boolean
  includeRoutes?: boolean
  includePods?: boolean
}

export interface CreateContainerInput {
  name: string
  image: string
  replicas?: number
  cpu?: string
  memory?: string
  ports?: Array<{ name: string; port: number; protocol?: string }>
  env?: Record<string, string>
  command?: string
}

/**
 * Repository for managing container resources
 * 
 * Write operations go through Karmada (propagates to member clusters)
 * Sub-resource reads (pods, metrics) go through project.cluster
 */
export class ContainerRepository extends BaseRepository<
  Container,
  ContainerSummary,
  CreateContainerInput,
  ListContainersOptions
> {
  constructor(
    kubeClient: Record<KubeCluster, KubeClient>,
    project: RepositoryProject,
  ) {
    super(kubeClient, project)
  }

  /**
   * List all containers in the namespace
   */
  async list(options: ListContainersOptions = {}): Promise<Container[]> {
    const {
      name,
      includeMetrics = false,
      includeRoutes = false,
      includePods = true,
      labelSelector = 'ctnr.io/name',
    } = options

    // Build label selector
    const selector = name ? `ctnr.io/name=${name}` : labelSelector

    // Fetch deployments from Karmada
    const deployments = await this.karmada.AppsV1.namespace(this.namespace).getDeploymentList({
      labelSelector: selector,
    })

    // Parallel fetch optional data from workload cluster
    const [pods, metrics, routes] = await Promise.all([
      includePods ? this.fetchPods(selector) : Promise.resolve([]),
      includeMetrics ? this.fetchMetrics() : Promise.resolve([]),
      includeRoutes ? this.fetchRoutes() : Promise.resolve({ http: [], ingress: [] }),
    ])

    // Transform deployments to containers
    return deployments.items.map((deployment: Deployment) =>
      deploymentToContainer(deployment, {
        pods,
        metrics,
        routes,
      })
    )
  }

  /**
   * List container summaries (lightweight, no pods/metrics)
   */
  async listSummaries(options: ListContainersOptions = {}): Promise<ContainerSummary[]> {
    const { name, labelSelector = 'ctnr.io/name' } = options
    const selector = name ? `ctnr.io/name=${name}` : labelSelector

    const deployments = await this.karmada.AppsV1.namespace(this.namespace).getDeploymentList({
      labelSelector: selector,
    })

    return deployments.items.map(deploymentToContainerSummary)
  }

  /**
   * Get a single container by name
   */
  async get(name: string, options: Omit<ListContainersOptions, 'name'> = {}): Promise<Container | null> {
    const containers = await this.list({ ...options, name })
    return containers[0] ?? null
  }

  /**
   * Check if a container exists (reads from Karmada)
   */
  async exists(name: string): Promise<boolean> {
    try {
      await this.karmada.AppsV1.namespace(this.namespace).getDeployment(name)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a new container (writes to Karmada)
   * Note: For full container creation with all options, use the run handler
   */
  async create(_input: CreateContainerInput): Promise<Container> {
    // Container creation is complex and handled by the run handler
    // This is a placeholder for the interface requirement
    throw new Error('Use the run handler for container creation')
  }

  /**
   * Delete a container by name (writes to Karmada, propagates to clusters)
   */
  async delete(name: string, signal?: AbortSignal): Promise<void> {
    await this.karmada.AppsV1.namespace(this.namespace).deleteDeployment(name, {
      abortSignal: signal,
    })
  }

  // Extended methods specific to containers

  /**
   * Get the raw Kubernetes Deployment (from Karmada)
   */
  async getDeployment(name: string): Promise<Deployment | null> {
    try {
      return await this.karmada.AppsV1.namespace(this.namespace).getDeployment(name)
    } catch {
      return null
    }
  }

  /**
   * Stop a container (set replicas to 0)
   */
  async stop(name: string, signal?: AbortSignal): Promise<void> {
    await this.karmada.AppsV1.namespace(this.namespace).patchDeployment(name, 'json-merge', {
      spec: { replicas: 0, template: {}, selector: {} },
    })
    // Delete HPA if exists
    await this.karmada.AutoScalingV2Api.namespace(this.namespace).deleteHorizontalPodAutoscaler(name, {
      abortSignal: signal,
    }).catch(() => {})
  }

  /**
   * Scale a container to specified replicas
   */
  async scale(name: string, replicas: number): Promise<void> {
    await this.karmada.AppsV1.namespace(this.namespace).patchDeployment(name, 'json-merge', {
      spec: { replicas, template: {}, selector: {} },
    })
  }

  /**
   * Delete pods for a container
   */
  async deletePods(name: string, signal?: AbortSignal): Promise<void> {
    await this.karmada.CoreV1.namespace(this.namespace).deletePodList({
      labelSelector: `ctnr.io/name=${name}`,
      abortSignal: signal,
    })
  }

  /**
   * Watch deployments in the namespace
   */
  watchDeployments(options: { labelSelector?: string; signal?: AbortSignal } = {}) {
    return this.karmada.AppsV1.namespace(this.namespace).watchDeploymentList({
      labelSelector: options.labelSelector ?? 'ctnr.io/name',
      abortSignal: options.signal,
    })
  }

  /**
   * Get container count (reads from Karmada)
   */
  async count(): Promise<number> {
    const deployments = await this.karmada.AppsV1.namespace(this.namespace).getDeploymentList({
      labelSelector: 'ctnr.io/name',
    })
    return deployments.items.length
  }

  // Private helper methods - read sub-resources from workload cluster

  private async fetchPods(labelSelector: string): Promise<Pod[]> {
    try {
      const pods = await this.workload.CoreV1.namespace(this.namespace).getPodList({
        labelSelector,
      })
      return pods.items
    } catch {
      return []
    }
  }

  private async fetchMetrics(): Promise<PodMetrics[]> {
    try {
      const metrics = await this.workload.MetricsV1Beta1(this.namespace).getPodsListMetrics({})
      return metrics.items as unknown as PodMetrics[]
    } catch {
      return []
    }
  }

  private async fetchRoutes(): Promise<{ http: HTTPRoute[]; ingress: IngressRoute[] }> {
    // Routes are read from Karmada as they're propagated resources
    const [httpResult, ingressResult] = await Promise.allSettled([
      this.karmada.GatewayNetworkingV1(this.namespace).listHTTPRoutes(),
      this.karmada.TraefikV1Alpha1(this.namespace).listIngressRoutes(),
    ])

    return {
      http: httpResult.status === 'fulfilled'
        ? (httpResult.value as unknown as { items: HTTPRoute[] }).items ?? []
        : [],
      ingress: ingressResult.status === 'fulfilled'
        ? (ingressResult.value as unknown as { items: IngressRoute[] }).items ?? []
        : [],
    }
  }
}
