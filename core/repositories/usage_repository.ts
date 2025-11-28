/**
 * Usage Repository
 * Handles resource usage and cost calculations for a project
 */
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'
import { ensureFederatedResourceQuota } from 'core/adapters/kubernetes/kube-client.ts'
import { getUsage as getUsageLib, type Usage, type BalanceStatus } from 'core/application/billing/usage.ts'
import { FreeTier, Tier } from 'core/application/billing/utils.ts'
import { type ResourceUsage } from 'core/application/billing/resource.ts'
import { getNamespaceBalance } from 'core/application/billing/balance.ts'
import { calculateTotalCostWithFreeTier } from 'core/application/billing/cost.ts'
import { type RepositoryProject, type KubeCluster } from './base_repository.ts'

// Re-export types from core/application/billing/usage.ts
export type { Usage, BalanceStatus }

/**
 * Usage list options (not really applicable for single project usage)
 */
export interface UsageOptions {
  additionalResource?: ResourceUsage
}

/**
 * Resource limits input
 */
export interface SetLimitsInput {
  cpu: string
  memory: string
  storage: string
}

/**
 * Usage Repository
 * Provides methods for getting resource usage and managing limits
 * 
 * Note: Unlike other repositories, this doesn't have CRUD operations
 * since usage is computed from Kubernetes resources, not stored directly
 */
export class UsageRepository {
  constructor(
    private readonly kubeClient: Record<KubeCluster, KubeClient>,
    private readonly project: RepositoryProject,
  ) {}

  /**
   * Karmada client for operations
   */
  private get karmada(): KubeClient {
    return this.kubeClient['karmada']
  }

  /**
   * Project namespace
   */
  private get namespace(): string {
    return this.project.namespace
  }

  /**
   * Get current resource usage and costs
   */
  async get(options: UsageOptions = {}, signal?: AbortSignal): Promise<Usage> {
    return getUsageLib({
      kubeClient: this.karmada,
      namespace: this.namespace,
      additionalResource: options.additionalResource,
      signal: signal ?? new AbortController().signal,
    })
  }

  /**
   * Get current balance
   */
  async getBalance(signal?: AbortSignal): Promise<{ credits: number; lastUpdated: string }> {
    const namespaceObj = await this.karmada.CoreV1.getNamespace(this.namespace, {
      abortSignal: signal,
    })
    const balance = getNamespaceBalance(namespaceObj)
    return {
      credits: balance.credits,
      lastUpdated: String(balance.lastUpdated),
    }
  }

  /**
   * Get current resource limits
   */
  async getLimits(signal?: AbortSignal): Promise<{ cpu: string; memory: string; storage: string }> {
    const balance = await this.getBalance(signal)
    
    if (balance.credits <= 0) {
      return {
        cpu: FreeTier.cpu,
        memory: FreeTier.memory,
        storage: FreeTier.storage,
      }
    }

    try {
      const resourceQuota = await this.karmada.KarmadaV1Alpha1(this.namespace).getFederatedResourceQuota(
        'ctnr-resource-quota',
        { abortSignal: signal },
      )
      
      return {
        cpu: resourceQuota.spec?.overall?.['limits.cpu'] || FreeTier.cpu,
        memory: resourceQuota.spec?.overall?.['limits.memory'] || FreeTier.memory,
        storage: resourceQuota.spec?.overall?.['requests.storage'] || FreeTier.storage,
      }
    } catch {
      return {
        cpu: FreeTier.cpu,
        memory: FreeTier.memory,
        storage: FreeTier.storage,
      }
    }
  }

  /**
   * Set resource limits
   * Requires credits to set limits above free tier
   */
  async setLimits(input: SetLimitsInput, signal?: AbortSignal): Promise<void> {
    const abortSignal = signal ?? new AbortController().signal
    const balance = await this.getBalance(abortSignal)
    
    if (balance.credits === 0) {
      // For free tier, set to free tier limits
      await ensureFederatedResourceQuota(this.karmada, this.namespace, {
        apiVersion: 'policy.karmada.io/v1alpha1',
        kind: 'FederatedResourceQuota',
        metadata: {
          name: 'ctnr-resource-quota',
          namespace: this.namespace,
          labels: {},
        },
        spec: {
          overall: {
            'limits.cpu': Tier['free'].cpu,
            'limits.memory': Tier['free'].memory,
            'requests.storage': Tier['free'].storage,
          },
        },
      }, abortSignal)
      throw new Error('User has no credits, limits set to Free Tier')
    }

    await ensureFederatedResourceQuota(this.karmada, this.namespace, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'FederatedResourceQuota',
      metadata: {
        name: 'ctnr-resource-quota',
        namespace: this.namespace,
        labels: {},
      },
      spec: {
        overall: {
          'limits.cpu': input.cpu,
          'limits.memory': input.memory,
          'requests.storage': input.storage,
        },
      },
    }, abortSignal)
  }

  /**
   * Calculate estimated cost for resources
   */
  calculateCost(cpu: string, memory: string, storage: string): {
    hourly: number
    daily: number
    monthly: number
  } {
    return calculateTotalCostWithFreeTier(cpu, memory, storage)
  }

  /**
   * Check if additional resources can be provisioned
   */
  async canProvision(
    additionalResource: ResourceUsage,
    signal?: AbortSignal,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const usage = await this.get({ additionalResource }, signal)

    switch (usage.status) {
      case 'normal':
      case 'free_tier':
        return { allowed: true }
      
      case 'insufficient_credits_for_additional_resource':
        return {
          allowed: false,
          reason: `Insufficient credits: balance ${usage.balance.credits}, next cost ${usage.costs.next.hourly.toFixed(4)}/hour`,
        }
      
      case 'resource_limits_reached_for_additional_resource':
        return {
          allowed: false,
          reason: 'Resource limits would be exceeded',
        }
      
      case 'insufficient_credits_for_current_usage':
        return {
          allowed: false,
          reason: 'Credit breach: current usage exceeds balance',
        }
      
      case 'resource_limits_reached_for_current_usage':
        return {
          allowed: false,
          reason: 'Current resource limits already reached',
        }
      
      default:
        return { allowed: false, reason: `Unknown status: ${usage.status}` }
    }
  }
}
