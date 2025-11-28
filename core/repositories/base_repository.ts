/**
 * Base Repository
 * Abstract base class for all Kubernetes resource repositories
 * 
 * Provides common functionality and standardized interface for:
 * - Karmada (control plane) for write operations
 * - Workload clusters for read operations
 */
import type { KubeClient } from 'core/adapters//kubernetes/kube-client.ts'

export type KubeCluster = 'karmada' | 'eu-0' | 'eu-1' | 'eu-2'

/**
 * Project context for repository operations
 * Note: ownerId is set at namespace level, not on individual resources
 */
export interface RepositoryProject {
  id: string
  namespace: string
  cluster: string
}

/**
 * Common list options interface
 */
export interface ListOptions {
  name?: string
  labelSelector?: string
}

/**
 * Abstract base repository class
 * 
 * @template T - Full resource type (e.g., Container, Volume, Route)
 * @template TSummary - Summary/lightweight version of resource
 * @template TCreateInput - Input type for create operations
 * @template TListOptions - Options for list operations
 */
export abstract class BaseRepository<
  T,
  TSummary = T,
  TCreateInput = Partial<T>,
  TListOptions extends ListOptions = ListOptions,
> {
  constructor(
    protected readonly kubeClient: Record<KubeCluster, KubeClient>,
    protected readonly project: RepositoryProject,
  ) {}

  /**
   * Karmada client for write operations (propagates to member clusters)
   */
  protected get karmada(): KubeClient {
    return this.kubeClient['karmada']
  }

  /**
   * Workload cluster client for reading sub-resources (pods, metrics, etc.)
   */
  protected get workload(): KubeClient {
    return this.kubeClient[this.project.cluster as KubeCluster]
  }

  /**
   * Project namespace
   */
  protected get namespace(): string {
    return this.project.namespace
  }

  /**
   * List all resources
   */
  abstract list(options?: TListOptions): Promise<T[]>

  /**
   * List resource summaries (lightweight)
   */
  abstract listSummaries(options?: TListOptions): Promise<TSummary[]>

  /**
   * Get a single resource by name
   */
  abstract get(name: string): Promise<T | null>

  /**
   * Check if a resource exists
   */
  abstract exists(name: string): Promise<boolean>

  /**
   * Create a new resource
   */
  abstract create(input: TCreateInput): Promise<T>

  /**
   * Delete a resource by name
   */
  abstract delete(name: string): Promise<void>
}

/**
 * Abstract base repository for owner-scoped resources (like projects)
 * Uses ownerId instead of project context
 */
export abstract class BaseOwnerRepository<
  T,
  TSummary = T,
  TCreateInput = Partial<T>,
  TListOptions extends ListOptions = ListOptions,
> {
  constructor(
    protected readonly kubeClient: Record<KubeCluster, KubeClient>,
    protected readonly ownerId: string,
  ) {}

  /**
   * Kubernetes client for write operations
   */
  protected get karmada(): KubeClient {
    return this.kubeClient['karmada']
  }

  /**
   * List all resources
   */
  abstract list(options?: TListOptions, signal?: AbortSignal): Promise<T[]>

  /**
   * List resource summaries (lightweight)
   */
  abstract listSummaries(options?: TListOptions, signal?: AbortSignal): Promise<TSummary[]>

  /**
   * Get a single resource by ID
   */
  abstract get(id: string, signal?: AbortSignal): Promise<T | null>

  /**
   * Check if a resource exists
   */
  abstract exists(id: string, signal?: AbortSignal): Promise<boolean>

  /**
   * Create a new resource
   */
  abstract create(id: string, input: TCreateInput, signal?: AbortSignal): Promise<T>

  /**
   * Delete a resource by ID
   */
  abstract delete(id: string, signal?: AbortSignal): Promise<void>
}
