import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { BillingClientRepository } from 'core/repositories/mod.ts'
import type { BillingClient } from 'core/entities/billing/client.ts'

export const Meta = {}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = BillingClient

export default async function* ({ ctx }: ServerRequest<Input>): ServerResponse<Output> {
  const billingClientRepository = new BillingClientRepository(
    ctx.kube.client,
    ctx.billing.client['qonto'],
    ctx.billing.qontoClientId,
    ctx.auth.user.id,
  )

  const client = await billingClientRepository.get()
  
  if (!client) {
    // Return default client
    return {
      type: 'individual',
      firstName: '',
      lastName: '',
      currency: 'EUR',
      locale: 'fr',
      billingAddress: {
        streetAddress: '',
        city: '',
        postalCode: '',
        countryCode: '',
      },
    }
  }

  return client
}
