import { FreeTier } from 'core/rules/billing/utils.ts'
import { ensureFederatedResourceQuota, KubeClient } from 'infra/kubernetes/mod.ts'
import { calculateTotalCostWithFreeTier } from './cost.ts'
import { Balance, getNamespaceBalance, getNextBalance, updateBalance } from './balance.ts'
import {
  extractDeploymentCurrentResourceUsage,
  parseResourceToPrimitiveValue,
  parseResourceUsageToPrimitiveValues,
  ResourceUsage,
} from './resource.ts'

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
  | 'resource_limits_reached_for_additional_resource'
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
  cpu: parseResourceToPrimitiveValue(FreeTier.cpu, 'cpu'), // 1 CPU in millicores
  memory: parseResourceToPrimitiveValue(FreeTier.memory, 'memory'), // 2GB in MB
  storage: parseResourceToPrimitiveValue(FreeTier.storage, 'storage'), // 10GB
}

export async function getUsage(opts: {
  kubeClient: KubeClient
  namespace: string
  additionalResource?: ResourceUsage
  signal: AbortSignal
}): Promise<Usage> {
  const { kubeClient, namespace, additionalResource, signal } = opts

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
      parsedLimits = parseResourceUsageToPrimitiveValues({
        cpu: resourceQuota.spec.overall['limits.cpu'] || '0',
        memory: resourceQuota.spec.overall['limits.memory'] || '0',
        storage: resourceQuota.spec.overall['requests.storage'] || '0',
      })
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
    const { cpu, memory, storage } = parseResourceUsageToPrimitiveValues(
      extractDeploymentCurrentResourceUsage(deployment),
    )
    totalMilliCpuUsed += cpu
    totalMemoryUsed += memory
    totalStorageUsed += storage
  }

  // Get storage usage
  try {
    const pvcs = await kubeClient.CoreV1.namespace(namespace).getPersistentVolumeClaimList({
      abortSignal: signal,
    })

    for (const pvc of pvcs.items) {
      const storageRequest = pvc.spec?.resources?.requests?.storage.serialize() || '0Gi'
      totalStorageUsed += parseResourceToPrimitiveValue(storageRequest, 'storage')
    }
  } catch (error) {
    console.warn('Failed to fetch storage usage:', error)
  }

  // Calculate usage percentages
  const resources: Usage['resources'] = {
    cpu: {
      used: totalMilliCpuUsed + 'm',
      limit: parsedLimits.cpu + 'm',
      next: totalMilliCpuUsed + parseResourceToPrimitiveValue(additionalResource?.cpu || '0', 'cpu') + 'm',
      percentage: parsedLimits.cpu === Infinity ? 0 : Math.round((totalMilliCpuUsed / parsedLimits.cpu) * 100),
    },
    memory: {
      used: totalMemoryUsed + 'M',
      limit: parsedLimits.memory + 'M',
      next: totalMemoryUsed + parseResourceToPrimitiveValue(additionalResource?.memory || '0', 'memory') + 'M',
      percentage: parsedLimits.memory === Infinity ? 0 : Math.round((totalMemoryUsed / parsedLimits.memory) * 100),
    },
    storage: {
      used: totalStorageUsed + 'G',
      limit: parsedLimits.storage + 'G',
      next: totalStorageUsed + parseResourceToPrimitiveValue(additionalResource?.storage || '0', 'storage') + 'G',
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

  const nextCost = additionalResource
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
  } else if (additionalResource && nextCost.hourly > balance.credits) {
    status = 'insufficient_credits_for_additional_resource'
  } else if (additionalResource && nextCost.daily > limitCost.daily) {
    status = 'resource_limits_reached_for_additional_resource'
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

export async function* checkUsage(opts: {
  kubeClient: KubeClient
  namespace: string
  additionalResource?: ResourceUsage
  force?: boolean
  signal: AbortSignal
}): AsyncGenerator<string, Usage> {
  const { kubeClient, namespace, signal } = opts

  const usage = await getUsage({ kubeClient, namespace, signal, additionalResource: opts.additionalResource })

  // Default free tier limits (in proper units)
  yield '🔎 Checking resource usage and credit balance...'

  // Display current usage information
  yield `${usage.tier === 'free' ? '🆓' : '⚡️'} Account Status: ${
    usage.tier === 'free' ? 'Free Tier' : 'Paid'
  } | Credits: ${usage.balance.credits}`

  // Check status and provide appropriate messages
  switch (usage.status) {
    case 'insufficient_credits_for_current_usage': {
      yield `🚨 Credit breach! Current usage (${
        usage.costs.current.hourly.toFixed(4)
      } credits/hour) exceeds your balance (${usage.balance.credits} credits)`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to purchase more credits immediately.`

      // Retrieve last threshold breach time
      let namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, { abortSignal: signal })
      const thresholdDate = namespaceObj.metadata?.annotations?.['ctnr.io/credits-threshold-breach-datetime'] || null
      // If no breach time is set, it means this is the first time we hit the limit, so add one
      if (!thresholdDate) {
        namespaceObj = await kubeClient.CoreV1.patchNamespace(
          namespace,
          'json-merge',
          {
            metadata: {
              annotations: {
                'ctnr.io/credits-threshold-breach-datetime': new Date().toISOString(),
              },
            },
          },
          { abortSignal: signal },
        )
      }
      const hours = thresholdDate
        ? Math.max(0, 24 - Math.floor((Date.now() - new Date(thresholdDate).getTime()) / 3600000))
        : 24
      if (hours > 0) {
        yield `⏳ You have ${hours} hours to add credits before your resources are paused.`
        // TODO: send notification to user email
      } else {
        yield `⏳ Grace period expired. Resources will be paused.`
        // Get all deployments and scale to 0
        const deployments = await kubeClient.AppsV1.namespace(namespace).getDeploymentList({
          abortSignal: signal,
        })

        await Promise.allSettled(
          deployments.items.map((deployment) => {
            const name = deployment.metadata?.name
            if (!name) return Promise.resolve()
            console.debug(`Scaling down deployment ${name} in namespace ${namespace} due to credit breach`)
            return kubeClient.AppsV1.namespace(namespace).patchDeployment(
              name,
              'json-merge',
              {
                spec: {
                  replicas: 0,
                  selector: {},
                  template: {},
                },
              },
              { abortSignal: signal },
            ).catch((error) => {
              console.error(`Failed to scale down deployment ${name} in namespace ${namespace}:`, error)
            })
          }),
        )
      }
      throw new Error('Credit breach detected')
    }

    case 'insufficient_credits_for_additional_resource': {
      yield `⚠️  Insufficient credits for this additional provisioning! Next usage would exceed your balance.`
      yield `💰 Balance: ${usage.balance.credits} credits, Next cost: ${
        usage.costs.next.hourly.toFixed(4)
      } credits/hour`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to purchase more credits.`
      if (!opts.force) {
        throw new Error('Insufficient credits for provisioning')
      }
      yield `🚨 Force flag enabled but insufficient credits - cannot proceed with forced resource creation.`
      throw new Error('Cannot force resource creation: insufficient credits')
    }

    case 'resource_limits_reached_for_current_usage': {
      const limitWarnings = []
      if (usage.resources.cpu.percentage >= 100) limitWarnings.push(`CPU (${usage.resources.cpu.percentage}%)`)
      if (usage.resources.memory.percentage >= 100) limitWarnings.push(`Memory (${usage.resources.memory.percentage}%)`)
      if (usage.resources.storage.percentage >= 100) {
        limitWarnings.push(`Storage (${usage.resources.storage.percentage}%)`)
      }

      yield `⚠️  Resource limit reached for: ${limitWarnings.join(', ')}`
      yield `📊 Current usage: CPU ${usage.resources.cpu.used}/${usage.resources.cpu.limit}, Memory ${usage.resources.memory.used}/${usage.resources.memory.limit}, Storage ${usage.resources.storage.used}/${usage.resources.storage.limit}`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to increase your resource limits.`
      throw new Error('Resource limits reached')
    }

    case 'resource_limits_reached_for_additional_resource': {
      yield `⚠️  Resource limit would be exceeded with this additional provisioning!`
      yield `📊 With additional: CPU ${usage.resources.cpu.next}/${usage.resources.cpu.limit}, Memory ${usage.resources.memory.next}/${usage.resources.memory.limit}, Storage ${usage.resources.storage.next}/${usage.resources.storage.limit}`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to increase your resource limits.`
      if (!opts.force) {
        throw new Error('Resource limits would be exceeded with provisioning')
      }
      yield `🔥 Force flag enabled - proceeding despite resource limit warnings!`
      yield `⚠️  Warning: This may cause resource contention and performance issues.`
      break
    }

    // TODO: add low_balance case w/ notification only if credits < 5 * max daily cost

    case 'free_tier':
      yield `✅ Free tier usage check passed`
      yield `📊 Usage: CPU ${usage.resources.cpu.used}/${usage.resources.cpu.limit} (${usage.resources.cpu.percentage}%), Memory ${usage.resources.memory.used}/${usage.resources.memory.limit} (${usage.resources.memory.percentage}%), Storage ${usage.resources.storage.used}/${usage.resources.storage.limit} (${usage.resources.storage.percentage}%)`
      break

    case 'normal':
      yield `✅ Usage and credit check passed`
      yield `📊 Usage: CPU ${usage.resources.cpu.used}/${usage.resources.cpu.limit} (${usage.resources.cpu.percentage}%), Memory ${usage.resources.memory.used}/${usage.resources.memory.limit} (${usage.resources.memory.percentage}%), Storage ${usage.resources.storage.used}/${usage.resources.storage.limit} (${usage.resources.storage.percentage}%)`
      yield `💰 Daily cost: ${usage.costs.current.daily.toFixed(4)} credits (Balance: ${usage.balance.credits} credits)`
      break

    default:
      yield `⚠️  Unknown status: ${usage.status}`
      break
  }
  return usage
}
