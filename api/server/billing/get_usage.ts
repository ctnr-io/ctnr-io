import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { calculateTotalCostWithFreeTier, FreeTier, parseResourceUsage, parseResourceValue } from 'lib/billing/utils.ts'

export const Meta = {
  aliases: {},
}

export const Input = z.object({
  // Optional additional resource usage for provisioning requests
  additionalUsage: z.object({
    cpu: z.string(),
    memory: z.string(),
    storage: z.string(),
  }).optional(),
})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export interface Container {
  name: string
  cpu: string
  memory: string
  storage: string
  replicas: number
  costs: {
    hourly: number
    daily: number
    monthly: number
  }
}

/**
 * Represents the current status of the user's balance.
 * - 'normal': The user is within their resource limits and has sufficient credits.
 * - 'resource_limits_reached_for_current_usage': The user has reached their resource limits.
 * - 'insufficient_credits_for_current_usage': The user has insufficient credits for current usage.
 * - 'insufficient_credits_for_additional_resource': The user has insufficient credits for additional provisioning.
 * - 'free_tier': The user is on the free tier and has limited resources.
 */
export type BalanceStatus = 
  | 'normal'
  | 'resource_limits_reached_for_current_usage'
  | 'insufficient_credits_for_current_usage'
  | 'insufficient_credits_for_additional_resource'
  | 'free_tier'

export interface Output {
  // Credit information
  credits: {
    balance: number
    currency: string
  }

  // Current resource usage
  usage: {
    cpu: { used: string; limit: string; next: string; percentage: number }
    memory: { used: string; limit: string; next: string; percentage: number }
    storage: { used: string; limit: string; next: string; percentage: number }
  }

  limits: {
    cpu: string
    memory: string
    storage: string
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
    },
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

export default async function* (
  { ctx, signal, input }: ServerRequest<Input>,
): ServerResponse<Output> {
  // Default free tier limits (in proper units)

  let credits = 0
  let parsedLimits = { ...freeTierLimits }

  const kubeClient = ctx.kube.client['eu']
  const namespace = ctx.kube.namespace

  // Get namespace to check credits and tier
  try {
    const namespaceObj = await kubeClient.CoreV1.getNamespace(namespace, {
      abortSignal: signal,
    })

    const annotations = namespaceObj.metadata?.annotations || {}
    const creditsAnnotation = annotations['ctnr.io/credits-balance']

    // Parse credits
    if (creditsAnnotation) {
      const parsed = parseInt(creditsAnnotation, 10)
      if (!isNaN(parsed) && parsed >= 0) {
        credits = parsed
      }
    }
  } catch (error) {
    console.warn('Failed to get namespace or credits:', error)
    // Keep default credits = 0
  }

  // For free tier users (credits = 0), always use free tier limits
  // For paid users, try to get limits from resource quota
  if (credits > 0) {
    try {
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
    } catch (error) {
      console.warn('Failed to get resource quota for paid user, using free tier limits:', error)
      // Keep free tier limits
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
  const usage: Output['usage'] = {
    cpu: {
      used: totalMilliCpuUsed + 'm',
      limit: parsedLimits.cpu + 'm',
      next: totalMilliCpuUsed + parseResourceValue(input.additionalUsage?.cpu || '0', 'cpu') + 'm',
      percentage: parsedLimits.cpu === Infinity ? 0 : Math.round((totalMilliCpuUsed / parsedLimits.cpu) * 100),
    },
    memory: {
      used: totalMemoryUsed + 'M',
      limit: parsedLimits.memory + 'M',
      next: totalMemoryUsed + parseResourceValue(input.additionalUsage?.memory || '0', 'memory') + 'M',
      percentage: parsedLimits.memory === Infinity ? 0 : Math.round((totalMemoryUsed / parsedLimits.memory) * 100),
    },
    storage: {
      used: totalStorageUsed + 'G',
      limit: parsedLimits.storage + 'G',
      next: totalStorageUsed + parseResourceValue(input.additionalUsage?.storage || '0', 'storage') + 'G',
      percentage: parsedLimits.storage === Infinity ? 0 : Math.round((totalStorageUsed / parsedLimits.storage) * 100),
    },
  }

  const limits: Output['limits'] = {
    cpu: usage.cpu.limit,
    memory: usage.memory.limit,
    storage: usage.storage.limit,
  }

  const currentCost = calculateTotalCostWithFreeTier(
    usage.cpu.used,
    usage.memory.used,
    usage.storage.used,
  )

  const nextCost = input.additionalUsage
    ? calculateTotalCostWithFreeTier(
      usage.cpu.next,
      usage.memory.next,
      usage.storage.next,
    )
    : currentCost

  const limitCost = calculateTotalCostWithFreeTier(
    usage.cpu.limit,
    usage.memory.limit,
    usage.storage.limit,
  )
  const maxCost = currentCost.daily > limitCost.daily ? currentCost : limitCost

  // Determine status
  let status: BalanceStatus = 'normal'

  // Check if any resource limit is reached (>= 100%)
  const resourceLimitReached = usage.cpu.percentage >= 100 ||
    usage.memory.percentage >= 100 ||
    usage.storage.percentage >= 100

  // Priority order for status determination:
  // 1. If current usage exceeds credits, it's a breach
  // 2. If resource limits are reached, that takes priority over credit issues
  // 3. If next usage would exceed credits, insufficient credits
  // 4. If credits are 0, it's free tier (unless other issues exist)
  
  if (currentCost.hourly > credits) {
    status = 'insufficient_credits_for_current_usage'
  } else if (resourceLimitReached) {
    status = 'resource_limits_reached_for_current_usage'
  } else if (input.additionalUsage && nextCost.hourly > credits) {
    status = 'insufficient_credits_for_additional_resource'
  } else if (credits === 0) {
    status = 'free_tier'
  } else {
    status = 'normal'
  }

  // Determine tier
  const tier = credits > 0 ? 'paid' : 'free' as 'free' | 'paid'

  const result: Output = {
    credits: {
      balance: credits,
      currency: 'credits',
    },
    usage,
    limits,
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
