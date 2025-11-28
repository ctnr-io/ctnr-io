/**
 * Project Repository
 * Provides data access for project resources (Kubernetes Namespaces)
 * 
 * All project operations go through Karmada (control plane)
 * Projects are represented as namespaces with specific labels
 */
import type { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import type { Project, ProjectSummary, CreateProjectInput } from 'core/entities/tenancy/project.ts'
import { ClusterName, ClusterNames } from 'core/entities/common.ts'
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'
import { namespaceToProject, namespaceToProjectSummary, getNamespaceName } from 'core/adapters//kubernetes/transform/project.ts'
import { createProjectLabels, ProjectLabels } from 'core/adapters/kubernetes/labels/project.ts'
import { FreeTier } from 'core/application/billing/utils.ts'
import {
  ensureNamespace,
  ensurePropagationPolicy,
  ensureCiliumNetworkPolicy,
  ensureFederatedResourceQuota,
  type CiliumNetworkPolicy,
} from 'core/adapters/kubernetes/kube-client.ts'
import { yaml } from '@tmpl/core'
import * as YAML from '@std/yaml'
import { BaseOwnerRepository, type ListOptions, type KubeCluster } from './base_repository.ts'
import { addCredits, getNamespaceBalance } from '../application/billing/balance.ts'

export interface ListProjectsOptions extends ListOptions {
  id?: string
}

/**
 * Repository for managing project resources
 * 
 * All operations go through Karmada (projects are namespace-based and propagated)
 */
export class ProjectRepository extends BaseOwnerRepository<
  Project,
  ProjectSummary,
  CreateProjectInput,
  ListProjectsOptions
> {
  constructor(
    kubeClient: Record<KubeCluster, KubeClient>,
    ownerId: string,
  ) {
    super(kubeClient, ownerId)
  }

  /**
   * List all projects for the user
   */
  async list(options: ListProjectsOptions = {}, signal?: AbortSignal): Promise<Project[]> {
    const { id, name } = options

    const labelSelectors = [
      `${ProjectLabels.OwnerId}=${this.ownerId}`,
      id && `${ProjectLabels.Id}=${id}`,
      name && `${ProjectLabels.Name}=${name}`,
    ].filter(Boolean).join(',')

    const namespaces = await this.karmada.CoreV1.getNamespaceList({
      labelSelector: labelSelectors,
      abortSignal: signal,
    })

    return namespaces.items.map(namespaceToProject)
  }

  /**
   * List project summaries (lightweight)
   */
  async listSummaries(options: ListProjectsOptions = {}, signal?: AbortSignal): Promise<ProjectSummary[]> {
    const { id, name } = options

    const labelSelectors = [
      `${ProjectLabels.OwnerId}=${this.ownerId}`,
      id && `${ProjectLabels.Id}=${id}`,
      name && `${ProjectLabels.Name}=${name}`,
    ].filter(Boolean).join(',')

    const namespaces = await this.karmada.CoreV1.getNamespaceList({
      labelSelector: labelSelectors,
      abortSignal: signal,
    })

    return namespaces.items.map(namespaceToProjectSummary)
  }

  /**
   * Get a single project by ID
   */
  async get(projectId: string, signal?: AbortSignal): Promise<Project | null> {
    const namespaceName = getNamespaceName(projectId, this.ownerId)
    try {
      const ns = await this.karmada.CoreV1.getNamespace(namespaceName, { abortSignal: signal })
      return namespaceToProject(ns)
    } catch {
      return null
    }
  }

  /**
   * Get project by name
   */
  async getByName(name: string, signal?: AbortSignal): Promise<Project | null> {
    const projects = await this.list({ name }, signal)
    return projects[0] ?? null
  }

  /**
   * Check if a project exists
   */
  async exists(projectId: string, signal?: AbortSignal): Promise<boolean> {
    const namespaceName = getNamespaceName(projectId, this.ownerId)
    try {
      await this.karmada.CoreV1.getNamespace(namespaceName, { abortSignal: signal })
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if a project name is already taken
   */
  async nameExists(name: string, signal?: AbortSignal): Promise<boolean> {
    const projects = await this.list({ name }, signal)
    return projects.length > 0
  }

  /**
   * Create a new project
   * This sets up the namespace, propagation policy, network policies, and resource quotas
   */
  async create(projectId: string, input: CreateProjectInput, signal: AbortSignal = AbortSignal.timeout(30000)): Promise<Project> {
    const { name } = input

    // Determine namespace name
    const namespaceName = getNamespaceName(projectId, this.ownerId)

    // Random cluster selection
    const cluster = ClusterNames[Math.floor(Math.random() * ClusterNames.length)] as ClusterName

    // Create labels
    const labels = createProjectLabels({
      id: projectId,
      name,
      ownerId: this.ownerId,
      cluster,
    })

    // Resource names
    const propagationPolicyName = namespaceName + '-propagation-policy'
    const networkPolicyName = namespaceName + '-network-policy'
    const resourceQuotaName = namespaceName + '-resource-quota'

    // 1. Create namespace
    await ensureNamespace(this.karmada, {
      metadata: {
        name: namespaceName,
        labels,
      },
    }, signal)

    // 2. Ensure propagation policy
    await ensurePropagationPolicy(this.karmada, namespaceName, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'PropagationPolicy',
      metadata: {
        name: propagationPolicyName,
        namespace: namespaceName,
        labels,
      },
      spec: {
        resourceSelectors: [{
          apiVersion: '*',
          kind: '*',
          namespace: namespaceName,
        }],
        placement: {
          clusterAffinity: {
            clusterNames: [cluster],
          },
        },
      },
    }, signal)

    // 3. Ensure network policies
    await ensureCiliumNetworkPolicy(
      this.karmada,
      namespaceName,
      yaml`
        apiVersion: cilium.io/v2
        kind: CiliumNetworkPolicy
        metadata:
          name: ${networkPolicyName}
          namespace: ${namespaceName}
          labels:
            "ctnr.io/owner-id": ${this.ownerId}
        spec:
          endpointSelector:
            matchLabels:
              "k8s:io.kubernetes.pod.namespace": ${namespaceName}
          ingress:
            - fromEndpoints:
                - matchLabels:
                    "k8s:io.kubernetes.pod.namespace": ${namespaceName}
            - fromEndpoints:
                - matchLabels:
                    "k8s:io.kubernetes.pod.namespace": ctnr-system
            - fromEndpoints:
                - matchLabels:
                    "k8s:io.kubernetes.pod.namespace": traefik
            - fromEntities:
                - world
          egress:
            - toEndpoints:
                - matchLabels:
                    "k8s:io.kubernetes.pod.namespace": ${namespaceName}
            - toEndpoints:
                - matchLabels:
                    io.kubernetes.pod.namespace: kube-system
                    k8s-app: kube-dns
              toPorts:
                - ports:
                  - port: "53"
                    protocol: TCP
                  - port: "53"
                    protocol: UDP
                  rules:
                    dns:
                      - matchPattern: "*"
            - toEndpoints:
                - matchLabels:
                    "k8s:io.kubernetes.pod.namespace": traefik
            - toEntities:
                - world
      `.parse<CiliumNetworkPolicy>(YAML.parse as unknown as (str: string) => CiliumNetworkPolicy).data!,
      signal,
    )

    // 4. Check project balance, set limits to Free Tier if no credits
    const namespaceObj = await this.karmada.CoreV1.getNamespace(namespaceName, { abortSignal: signal })
    const balance = getNamespaceBalance(namespaceObj)
    if (balance.credits === 0) {
      await ensureFederatedResourceQuota(this.karmada, namespaceName, {
        apiVersion: 'policy.karmada.io/v1alpha1',
        kind: 'FederatedResourceQuota',
        metadata: {
          name: resourceQuotaName,
          namespace: namespaceName,
          labels,
        },
        spec: {
          overall: {
            'limits.cpu': FreeTier.cpu,
            'limits.memory': FreeTier.memory,
            'requests.storage': FreeTier.storage,
          },
        },
      }, signal)
    }

    return {
      id: projectId,
      name,
      ownerId: this.ownerId,
      cluster,
      namespace: namespaceName,
      balance: {
        credits: balance.credits,
        currency: 'EUR',
      },
    }
  }

  /**
   * Delete a project by ID
   */
  async delete(projectId: string, signal?: AbortSignal): Promise<void> {
    const namespaceName = getNamespaceName(projectId, this.ownerId)
    await this.karmada.CoreV1.deleteNamespace(namespaceName, { abortSignal: signal })
  }

  /**
   * Get raw Kubernetes namespace
   */
  async getNamespace(projectId: string, signal?: AbortSignal): Promise<Namespace | null> {
    const namespaceName = getNamespaceName(projectId, this.ownerId)
    try {
      return await this.karmada.CoreV1.getNamespace(namespaceName, { abortSignal: signal })
    } catch {
      return null
    }
  }

  /**
   * Ensure project exists and is properly configured
   * This is called when accessing a project to make sure all resources are in place
   */
  async ensure(projectId: string, projectName?: string, signal: AbortSignal = AbortSignal.timeout(30000)): Promise<Project> {
    // Check if project exists
    const existing = await this.get(projectId, signal)
    
    if (existing) {
      // Project exists, just ensure it's properly configured
      // The create method is idempotent via ensureNamespace, ensurePropagationPolicy, etc.
      return await this.create(projectId, { name: existing.name }, signal)
    }

    if (!projectName) {
      throw new Error(`Project ${projectId} not found`)
    }

    // Create new project
    return await this.create(projectId, { name: projectName }, signal)
  }

  /**
   * Add credits to a project's balance
   */
  async addCredits(projectId: string, creditsToAdd: number, signal?: AbortSignal): Promise<{ credits: number; lastUpdated: string }> {
    const namespaceName = getNamespaceName(projectId, this.ownerId)
    const balance = await addCredits(
      this.karmada,
      namespaceName,
      creditsToAdd,
      signal ?? new AbortController().signal,
    )
    return {
      credits: balance.credits,
      lastUpdated: String(balance.lastUpdated),
    }
  }

  /**
   * Get project balance
   */
  async getBalance(projectId: string, signal?: AbortSignal): Promise<{ credits: number; lastUpdated: string }> {
    const namespace = await this.getNamespace(projectId, signal)
    if (!namespace) {
      throw new Error(`Project ${projectId} not found`)
    }
    const balance = getNamespaceBalance(namespace)
    return {
      credits: balance.credits,
      lastUpdated: String(balance.lastUpdated),
    }
  }
}
