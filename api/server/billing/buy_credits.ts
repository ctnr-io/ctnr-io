import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'

export const Meta = {}

export const Input = z.object({
  amount: z.number().int().min(1),
})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = {
  paymentUrl: string
  paymentId: string
}

export default async function* BuyCredits({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {
  yield `Initiating payment for ${input.amount} credits`

  /**
   * When using localhost, the expo ngrok will handle the call from *.exp.direct/api/*
   * Look at metro.config.cjs in the app directory for more information.
   */
  let apiUrl = Deno.env.get('CTNR_API_URL')
  if (apiUrl?.includes('localhost')) {
    // We use the app url as it should be ngrok
    apiUrl = `${Deno.env.get('CTNR_APP_URL')}/api`
  }
  const webhookUrl = `${apiUrl}/billing/webhook`

  // Redirect to the app
  const redirectUrl = `${Deno.env.get('CTNR_APP_URL')}/billing`

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
    webhookUrl,
    redirectUrl,
  })

  if (!payment.id || !payment._links?.checkout?.href) {
    throw new Error('Failed to create payment')
  }

  return {
    paymentUrl: payment._links.checkout.href,
    paymentId: payment.id,
  }
}
