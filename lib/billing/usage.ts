import { FreeTier, parseResourceUsage, parseResourceValue } from 'lib/billing/utils.ts'
import {
  ensureFederatedResourceQuota,
  KubeClient,
} from '../kubernetes/kube-client.ts'
import { calculateTotalCostWithFreeTier } from './cost.ts'
import { Balance, getNamespaceBalance, getNextBalance, updateBalance } from './balance.ts'

/**
 * Represents the current status of the user's balance.
 * - 'normal': The user is within their resource limits and has sufficient credits.
 * - 'resource_limits_reached_for_current_usage': The user has reached their resource limits.
 * - 'insufficient_credits_for_current_usage': The user has insufficient credits for current resources.
 * - 'insufficient_credits_for_additional_resource': The user has insufficient credits for additional provisioning.
 * - 'free_tier': The user is on the free tier and has limited resources.
 */
export type BalanceStatus =
  | 'normal'
  | 'resource_limits_reached_for_current_usage'
  | 'insufficient_credits_for_current_usage'
  | 'insufficient_credits_for_additional_resource'
  | 'free_tier'

export interface Usage {
  balance: Balance

  // Current resource usage
  resources: {
    cpu: { used: string; limit: string; next: string; percentage: number }
    memory: { used: string; limit: string; next: string; percentage: number }
    storage: { used: string; limit: string; next: string; percentage: number }
  }

  // Cost information
  costs: {
    current: {
      hourly: number
      daily: number
      monthly: number
    }
    next: {
      hourly: number
      daily: number
      monthly: number
    }
    max: {
      hourly: number
      daily: number
      monthly: number
    }
  }

  // Status information
  status: BalanceStatus

  // Tier information
  tier: 'free' | 'paid'
}

const freeTierLimits = {
  cpu: parseResourceValue(FreeTier.cpu, 'cpu'), // 1 CPU in millicores
  memory: parseResourceValue(FreeTier.memory, 'memory'), // 2GB in MB
  storage: parseResourceValue(FreeTier.storage, 'storage'), // 10GB
}

export async function getUsage(opts: {
  kubeClient: KubeClient
  namespace: string
  additionalUsage?: {
    cpu: string
    memory: string
    storage: string
  }
  signal: AbortSignal
}): Promise<Usage> {
  const { kubeClient, namespace, additionalUsage, signal } = opts

  // Default free tier limits (in proper units)
  let parsedLimits = { ...freeTierLimits }

  // Get namespace to check credits and tier
  const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
    abortSignal: signal,
  })

  let balance = getNamespaceBalance(namespaceObj)

  if (balance.credits <= 0) {
    // For free tier users, always use free tier limits
    parsedLimits = { ...freeTierLimits }
    // Ensure resource quota is set to free tier limits
    await ensureFederatedResourceQuota(kubeClient, namespace, {
      apiVersion: 'policy.karmada.io/v1alpha1',
      kind: 'FederatedResourceQuota',
      metadata: {
        name: 'ctnr-resource-quota',
        namespace: namespace,
        labels: {},
      },
      spec: {
        overall: {
          'limits.cpu': FreeTier.cpu,
          'limits.memory': FreeTier.memory,
          'requests.storage': FreeTier.storage,
        },
      },
    }, signal)
  } else {
    // For free tier users (credits = 0), always use free tier limits
    // For paid users, try to get limits from resource quota
    const resourceQuota = await kubeClient.KarmadaV1Alpha1(namespace).getFederatedResourceQuota(
      'ctnr-resource-quota',
      {
        abortSignal: signal,
      },
    )
    if (resourceQuota.spec?.overall) {
      parsedLimits = {
        cpu: parseResourceValue(resourceQuota.spec.overall['limits.cpu'], 'cpu'),
        memory: parseResourceValue(resourceQuota.spec.overall['limits.memory'], 'memory'),
        storage: parseResourceValue(resourceQuota.spec.overall['requests.storage'], 'storage'),
      }
    }
  }
  // For free tier users (credits = 0), we keep the freeTierLimits as set above

  // Get all deployments
  const deployments = await kubeClient.AppsV1.namespace(namespace).getDeploymentList({
    abortSignal: signal,
  })

  let totalMilliCpuUsed = 0
  let totalMemoryUsed = 0
  let totalStorageUsed = 0

  // Process each deployment
  for (const deployment of deployments.items) {
    const container = deployment.spec?.template?.spec?.containers?.[0]
    const replicas = deployment.status?.readyReplicas || 0
    if (container && replicas > 0) {
      const { cpu, memory, storage } = parseResourceUsage({
        cpu: deployment.spec?.template?.spec?.containers?.[0]?.resources?.limits?.cpu.serialize()!,
        memory: deployment.spec?.template?.spec?.containers?.[0]?.resources?.limits?.memory.serialize()!,
        storage: deployment.spec?.template?.spec?.containers?.[0]?.resources?.limits?.['ephemeral-storage']
          .serialize()!,
        replicas: deployment.status?.readyReplicas || 0,
      })
      totalMilliCpuUsed += cpu * replicas
      totalMemoryUsed += memory * replicas
      totalStorageUsed += (storage * replicas) / 3 // Divide by 3 for ephemeral storage
    }
  }

  // Get storage usage
  try {
    const pvcs = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaimList({
      abortSignal: signal,
    })

    for (const pvc of pvcs.items) {
      const storageRequest = pvc.spec?.resources?.requests?.storage || '0Gi'
      totalStorageUsed += parseResourceValue(storageRequest, 'storage')
    }
  } catch (error) {
    console.warn('Failed to fetch storage usage:', error)
  }

  // Calculate usage percentages
  const resources: Usage['resources'] = {
    cpu: {
      used: totalMilliCpuUsed + 'm',
      limit: parsedLimits.cpu + 'm',
      next: totalMilliCpuUsed + parseResourceValue(additionalUsage?.cpu || '0', 'cpu') + 'm',
      percentage: parsedLimits.cpu === Infinity ? 0 : Math.round((totalMilliCpuUsed / parsedLimits.cpu) * 100),
    },
    memory: {
      used: totalMemoryUsed + 'M',
      limit: parsedLimits.memory + 'M',
      next: totalMemoryUsed + parseResourceValue(additionalUsage?.memory || '0', 'memory') + 'M',
      percentage: parsedLimits.memory === Infinity ? 0 : Math.round((totalMemoryUsed / parsedLimits.memory) * 100),
    },
    storage: {
      used: totalStorageUsed + 'G',
      limit: parsedLimits.storage + 'G',
      next: totalStorageUsed + parseResourceValue(additionalUsage?.storage || '0', 'storage') + 'G',
      percentage: parsedLimits.storage === Infinity ? 0 : Math.round((totalStorageUsed / parsedLimits.storage) * 100),
    },
  }

  // Update balance based on current usage if lastUpdated < 1 minutes ago
  const lastUpdatedDiff = Date.now() - new Date(balance.lastUpdated).getTime()
  if (lastUpdatedDiff > 60 * 1000) {
    const nextBalance = getNextBalance(balance, {
      cpu: resources.cpu.used,
      memory: resources.memory.used,
      storage: resources.storage.used,
    })
    balance = await updateBalance(kubeClient, namespace, nextBalance, signal)
  }

  const currentCost = calculateTotalCostWithFreeTier(
    resources.cpu.used,
    resources.memory.used,
    resources.storage.used,
  )

  const nextCost = additionalUsage
    ? calculateTotalCostWithFreeTier(
      resources.cpu.next,
      resources.memory.next,
      resources.storage.next,
    )
    : currentCost

  const limitCost = calculateTotalCostWithFreeTier(
    resources.cpu.limit,
    resources.memory.limit,
    resources.storage.limit,
  )
  const maxCost = currentCost.daily > limitCost.daily ? currentCost : limitCost

  // Determine status
  let status: BalanceStatus = 'normal'

  // Check if any resource limit is reached (>= 100%)
  const resourceLimitReached = resources.cpu.percentage >= 100 ||
    resources.memory.percentage >= 100 ||
    resources.storage.percentage >= 100


  // Priority order for status determination:
  // 1. If current usage exceeds credits, it's a breach
  // 2. If resource limits are reached, that takes priority over credit issues
  // 3. If next usage would exceed credits, insufficient credits
  // 4. If credits are 0, it's free tier (unless other issues exist)
  if (currentCost.hourly > balance.credits) {
    status = 'insufficient_credits_for_current_usage'
  } else if (resourceLimitReached) {
    status = 'resource_limits_reached_for_current_usage'
  } else if (additionalUsage && nextCost.hourly > balance.credits) {
    status = 'insufficient_credits_for_additional_resource'
  } else if (balance.credits === 0) {
    status = 'free_tier'
  } else {
    status = 'normal'
  }

  // Determine tier
  const tier = balance.credits > 0 ? 'paid' : 'free' as 'free' | 'paid'

  const result: Usage = {
    balance,
    resources,
    costs: {
      current: currentCost,
      next: nextCost,
      max: maxCost,
    },
    // containers,
    status,
    tier,
  }

  return result
}
