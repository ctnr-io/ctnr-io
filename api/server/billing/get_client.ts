import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { match } from 'ts-pattern'
import { CreateClientRequest } from 'lib/billing/qonto/client.ts'
import { BillingClient } from 'lib/billing/utils.ts'

export const Meta = {}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = BillingClient

export default async function* ({ ctx }: ServerRequest<Input>): ServerResponse<Output> {
  let client: CreateClientRequest | undefined = undefined
  if (ctx.billing.qontoClientId) {
    const response = await ctx.billing.client['qonto'].getClientSDetails({ id: ctx.billing.qontoClientId }) as {
      client: CreateClientRequest
    }
    client = response.client
  }
  if (!client) {
    client = {
      first_name: '',
      last_name: '',
      type: 'individual',
      email: ctx.auth.user.email,
      billing_address: undefined,
    }
  }
  return {
    ...match(client.type)
      .with('individual', (type) => ({
        type,
        firstName: client.first_name ?? '',
        lastName: client.last_name ?? '',
      }))
      .with('freelance', (type) => ({
        type,
        firstName: client.first_name ?? '',
        lastName: client.last_name ?? '',
        vatNumber: client.vat_number ?? '',
      }))
      .with('company', (type) => ({
        type,
        name: client.name ?? '',
        vatNumber: client.vat_number ?? '',
      }))
      .otherwise(() => {
        throw new Error('Unknown client type ' + client.type)
      }),
    currency: client.currency as Output['currency'],
    locale: client.locale as Output['locale'],
    billingAddress: {
      streetAddress: client.billing_address?.street_address ?? '',
      city: client.billing_address?.city ?? '',
      postalCode: client.billing_address?.zip_code ?? '',
      provinceCode: client.billing_address?.province_code ?? '',
      countryCode: client.billing_address?.country_code ?? '',
    },
  }
}
