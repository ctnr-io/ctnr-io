import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { match } from 'ts-pattern'
import { SequenceType } from '@mollie/api-client'
import { BillingClient, PaymentMetadataV1 } from 'lib/billing/utils.ts'
import { CreateClientRequest } from 'lib/billing/qonto/client.ts'
import { ensureQontoInvoiceClient } from 'lib/billing/invoice.ts'

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

export type Input = {
  amount: number
  type: 'one-time' | 'first' | 'recurring'
  client: BillingClient
}

export const Output = z.any()

export type Output = {
  paymentUrl: string
  paymentId: string
}

export default async function* PurchaseCredits({ ctx, input, signal }: ServerRequest<Input>): ServerResponse<Output> {
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
        vat_number: '', // empty for individuals
      }))
      .with({ type: 'company' }, (client) => ({
        name: client.name,
        tax_identification_number: client.taxIdentificationNumber,
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

  await ensureQontoInvoiceClient({
    kubeClient: ctx.kube.client['eu'],
    namespace: ctx.kube.namespace,
    qontoClient: ctx.billing.client['qonto'],
    abortSignal: signal,
    invoiceClient: clientInfo,
  })

  const payment = await ctx.billing.client['mollie'].customerPayments.create({
    customerId: ctx.billing.mollieCustomerId,
    description: `Purchase ${input.amount} credits`,
    amount: {
      currency: currency,
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
