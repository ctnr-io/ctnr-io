import { ServerRequest, ServerResponse } from '../../_common.ts'
import { z } from 'zod'
import { Tier } from 'lib/billing/utils.ts'

export const Meta = {}

export const Input = z.object({
  tier: z.enum(Object.keys(Tier) as [keyof typeof Tier]),
})

export type Input = z.infer<typeof Input>

export type Output = {
  paymentUrl: string
  paymentId: string
  tier: string
  monthlyCost: number
}

export default async function* SubscribeTier({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {
  const { tier } = input

  yield `Creating subscription payment for ${tier} tier...`

  // Get the tier configuration
  const tierConfig = Tier[tier]
  if (!tierConfig) {
    throw new Error(`Invalid tier: ${tier}`)
  }

  // Calculate the monthly cost in EUR (credits * 0.01)
  const monthlyPriceEUR = (tierConfig.monthlyCreditCost * 0.01).toFixed(2)

  // Create a payment for the tier subscription
  const payment = await ctx.billing.client.payments.create({
    description: `Subscribe to ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier - Monthly Subscription`,
    amount: {
      currency: 'EUR',
      value: monthlyPriceEUR,
    },
    metadata: {
      userId: ctx.auth.user.id,
      tier: tier,
      subscriptionType: 'tier',
      monthlyCost: tierConfig.monthlyCreditCost.toString(),
    },
    webhookUrl: `${Deno.env.get('CTNR_API_URL')}/billing/webhook`,
    redirectUrl: `${Deno.env.get('CTNR_WEB_URL')}/billing/success?tier=${tier}`,
  })

  if (!payment.id || !payment._links?.checkout?.href) {
    throw new Error('Failed to create subscription payment')
  }

  yield `Payment created for ${tier} tier subscription`

  return {
    paymentUrl: payment._links.checkout.href,
    paymentId: payment.id,
    tier,
    monthlyCost: tierConfig.monthlyCreditCost,
  }
}
