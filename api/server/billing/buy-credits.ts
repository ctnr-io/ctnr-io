import { ServerRequest, ServerResponse } from '../../_common.ts'
import { z } from 'zod'

export const Meta = {}

export const Input = z.object({
  amount: z.number().int().min(1),
})

export type Input = z.infer<typeof Input>

export type Output = {
  paymentUrl: string
  paymentId: string
}

export default async function* BuyCredits({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {

  yield `Initiating payment for ${input.amount} credits`

  const payment = await ctx.billing.client.payments.create({
    description: `Purchase ${input.amount} credits`,
    amount: {
      currency: 'EUR',
      value: (input.amount * 0.01).toFixed(2),
    },
    metadata: {
      userId: ctx.auth.user.id,
      credits: input.amount.toString(),
    },
    webhookUrl: `${Deno.env.get('CTNR_API_URL')}/billing/webhook`,
    redirectUrl: `${Deno.env.get('CTNR_WEB_URL')}/billing/success`,
  })

  if (!payment.id || !payment._links?.checkout?.href) {
    throw new Error('Failed to create payment')
  }

  return {
    paymentUrl: payment._links.checkout.href,
    paymentId: payment.id,
  }
}
