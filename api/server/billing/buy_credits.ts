import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { match } from 'ts-pattern'
import { SequenceType } from '@mollie/api-client'
import { PaymentMetadataV1 } from 'lib/billing/utils.ts'
import { c } from '@tmpl/core'

export const Meta = {}

export const Input = z.object({
  amount: z.number().int().min(1),
  /**
   * The type of the payment sequence.
   * - `one-time`: A one-time payment
   * - `first`: The first payment in a series, called from the app
   * - `recurring`: A recurring payment when checking balance
   */
  type: z.enum(['one-time', 'first', 'recurring']),

  client: z.union([
    z.object({
      type: z.literal('individual'),
      firstName: z.string(),
      lastName: z.string(),
    }),
    z.object({
      type: z.literal('freelance'),
      firstName: z.string(),
      lastName: z.string(),
      vatNumber: z.string(),
    }),
    z.object({
      type: z.literal('company'),
      name: z.string(),
      vatNumber: z.string(),
    }),
  ])
    .and(z.object({
      currency: z.enum(['EUR']),
      locale: z.enum(['FR']),
      billingAddress: z.object({
        streetAddress: z.string(),
        city: z.string(),
        postalCode: z.string(),
        provinceCode: z.string(),
        countryCode: z.string(),
      }),
    })),
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

  const sequenceType: SequenceType = match(input.type)
    .with('one-time', () => SequenceType.oneoff)
    .with('first', () => SequenceType.first)
    .with('recurring', () => SequenceType.recurring)
    .exhaustive()
  
  const currency = 'EUR'

  // Save client informations to Qonto
  await ctx.billing.client['qonto'].updateClient(
    {
      id: ctx.billing.qontoClientId,
    },
    {
      ...match(input.client)
        .with({ type: 'individual' }, (client) => ({
          first_name: client.firstName,
          last_name: client.lastName,
        }))
        .with({ type: 'freelance' }, (client) => ({
          first_name: client.firstName,
          last_name: client.lastName,
          vat_number: client.vatNumber,
        }))
        .with({ type: 'company' }, (client) => ({
          name: client.name,
          vat_number: client.vatNumber,
        })),
      currency,
      locale: input.client.locale,
      billing_address: {
        street_address: input.client.billingAddress.streetAddress,
        city: input.client.billingAddress.city,
        zip_code: input.client.billingAddress.postalCode,
        province_code: input.client.billingAddress.provinceCode,
        country_code: input.client.billingAddress.countryCode,
      },
    },
  )

  const payment = await ctx.billing.client['mollie'].payments.create({
    description: `Purchase ${input.amount} credits`,
    amount: {
      currency,
      value: (input.amount * 0.01).toFixed(2),
    },
    metadata: {
      version: 1,
      userId: ctx.auth.user.id,
      qontoClientId: ctx.billing.qontoClientId,
      credits: input.amount,
      invoiceUrl: '',
    } satisfies PaymentMetadataV1,
    webhookUrl,
    redirectUrl,
    sequenceType,
  })

  if (!payment.id || !payment._links?.checkout?.href) {
    throw new Error('Failed to create payment')
  }

  return {
    paymentUrl: payment._links.checkout.href,
    paymentId: payment.id,
  }
}
