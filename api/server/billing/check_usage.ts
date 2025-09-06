import { z } from 'zod'
import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import getUsage, { Input as GetUsageInput, Output as GetUsageOutput } from './get_usage.ts'

export const Meta = {
  aliases: {},
}

export const Input = GetUsageInput

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = GetUsageOutput

export default async function* (
  request: ServerRequest<Input>,
): ServerResponse<Output> {
  // Default free tier limits (in proper units)
  yield '🔎 Checking resource usage and credit balance...'

  const usage = yield* getUsage(request)

  // Display current usage information
  yield `${usage.tier === 'free' ? '🆓' : '⚡️'} Account Status: ${
    usage.tier === 'free' ? 'Free Tier' : 'Paid'
  } | Credits: ${usage.credits.balance}`

  // Check status and provide appropriate messages
  switch (usage.status) {
    case 'insufficient_credits_for_current_usage': {
      yield `🚨 Credit breach! Current usage (${
        usage.costs.current.hourly.toFixed(4)
      } credits/hour) exceeds your balance (${usage.credits.balance} credits)`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to purchase more credits immediately.`

      // Retrieve last threshold breach time
      let namespaceObj = await request.ctx.kube.client['eu'].CoreV1.getNamespace(request.ctx.kube.namespace)
      const thresholdDate = namespaceObj.metadata?.annotations?.['ctnr.io/credits-threshold-breach-datetime'] || null
      // If no breach time is set, it means this is the first time we hit the limit, so add one
      if (!thresholdDate) {
        namespaceObj = await request.ctx.kube.client['eu'].CoreV1.patchNamespace(
          request.ctx.kube.namespace,
          'json-merge',
          {
            metadata: {
              annotations: {
                'ctnr.io/credits-threshold-breach-datetime': new Date().toISOString(),
              },
            },
          },
        )
      }
      const hours = thresholdDate
        ? Math.max(0, 24 - Math.floor((Date.now() - new Date(thresholdDate).getTime()) / 3600000))
        : 24
      if (hours > 0) {
        yield `⏳ You have ${hours} hours to add credits before your resources are paused.`
      } else {
        yield `⏳ Grace period expired. Resources will be paused.`
        // TODO: Implement resource pausing logic
        // Iterate over all deployment and rollout with replicas 0 and "suspended" label
        // When credits back, rollback
      }
      throw new Error('Credit breach detected')
    }

    case 'insufficient_credits_for_additional_resource': {
      yield `⚠️  Insufficient credits for additional provisioning! Next usage would exceed your balance.`
      yield `💰 Balance: ${usage.credits.balance} credits, Next cost: ${
        usage.costs.next.hourly.toFixed(4)
      } credits/hour`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to purchase more credits.`
      throw new Error('Insufficient credits for provisioning')
    }

    case 'resource_limits_reached_for_current_usage': {
      const limitWarnings = []
      if (usage.usage.cpu.percentage >= 100) limitWarnings.push(`CPU (${usage.usage.cpu.percentage}%)`)
      if (usage.usage.memory.percentage >= 100) limitWarnings.push(`Memory (${usage.usage.memory.percentage}%)`)
      if (usage.usage.storage.percentage >= 100) limitWarnings.push(`Storage (${usage.usage.storage.percentage}%)`)

      yield `⚠️  Resource limit reached for: ${limitWarnings.join(', ')}`
      yield `📊 Current usage: CPU ${usage.usage.cpu.used}/${usage.usage.cpu.limit}, Memory ${usage.usage.memory.used}/${usage.usage.memory.limit}, Storage ${usage.usage.storage.used}/${usage.usage.storage.limit}`
      yield `👉 Visit ${Deno.env.get('CTNR_APP_URL')}/billing to increase your resource limits.`
      throw new Error('Resource limits reached')
    }

    // TODO: add low_balance case

    case 'free_tier':
      yield `✅ Free tier usage check passed`
      yield `📊 Usage: CPU ${usage.usage.cpu.used}/${usage.usage.cpu.limit} (${usage.usage.cpu.percentage}%), Memory ${usage.usage.memory.used}/${usage.usage.memory.limit} (${usage.usage.memory.percentage}%), Storage ${usage.usage.storage.used}/${usage.usage.storage.limit} (${usage.usage.storage.percentage}%)`
      break

    case 'normal':
      yield `✅ Usage and credit check passed`
      yield `📊 Usage: CPU ${usage.usage.cpu.used}/${usage.usage.cpu.limit} (${usage.usage.cpu.percentage}%), Memory ${usage.usage.memory.used}/${usage.usage.memory.limit} (${usage.usage.memory.percentage}%), Storage ${usage.usage.storage.used}/${usage.usage.storage.limit} (${usage.usage.storage.percentage}%)`
      yield `💰 Daily cost: ${usage.costs.current.daily.toFixed(4)} credits (Balance: ${usage.credits.balance} credits)`
      break

    default:
      yield `⚠️  Unknown status: ${usage.status}`
      break
  }

  // TODO: here, resume all suspended resources if any

  return usage
}
