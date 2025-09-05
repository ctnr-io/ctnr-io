import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { match } from 'ts-pattern'
import { SequenceType } from '@mollie/api-client'
import { BillingClient, PaymentMetadataV1 } from 'lib/billing/utils.ts'
import { c } from '@tmpl/core'
import client, { CreateClientRequest } from 'lib/billing/qonto/client.ts'

export const Meta = {}

export const Input = z.object({
  amount: z.number().int().min(1).max(1000000, 'Amount cannot exceed 1,000,000 credits'),
  /**
   * The type of the payment sequence.
   * - `one-time`: A one-time payment
   * - `first`: The first payment in a series, called from the app
   * - `recurring`: A recurring payment when checking balance
   */
  type: z.enum(['one-time', 'first', 'recurring']),

  client: BillingClient,
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

  const clientInfo: CreateClientRequest = {
    type: input.client.type,
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
      }))
      .exhaustive(),
    currency,
    locale: input.client.locale,
    ...(input.client.billingAddress && {
      billing_address: {
        street_address: input.client.billingAddress.streetAddress,
        city: input.client.billingAddress.city,
        zip_code: input.client.billingAddress.postalCode,
        province_code: input.client.billingAddress.provinceCode,
        country_code: input.client.billingAddress.countryCode,
      },
    }),
  }
  if (!ctx.billing.qontoClientId) {
    const response = await ctx.billing.client['qonto'].createClient(clientInfo)
    if (!response.client?.id) {
      throw new Error('Failed to create Qonto client')
    }
    await ctx.kube.client['eu'].CoreV1.patchNamespace(ctx.kube.namespace, 'json-merge', {
      metadata: {
        labels: {
          'ctnr.io/qonto-client-id': response.client.id,
        },
      },
    })
  } else {
    // Save client informations to Qonto
    await ctx.billing.client['qonto'].updateClient(
      {
        id: ctx.billing.qontoClientId,
      },
      clientInfo,
    )
  }

  const payment = await ctx.billing.client['mollie'].payments.create({
    description: `Purchase ${input.amount} credits`,
    amount: {
      currency,
      value: (input.amount * 0.01).toFixed(2),
    },
    metadata: {
      version: 1,
      userId: ctx.auth.user.id,
      credits: input.amount,
      invoiceUrl: null,
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
