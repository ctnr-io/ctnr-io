import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { getBillingClient, type BillingClientContext } from 'core/data/billing/client.ts'
import type { BillingClient } from 'core/schemas/billing/client.ts'

export const Meta = {}

export const Input = z.object({})

export type Input = z.infer<typeof Input>

export const Output = z.any()

export type Output = BillingClient

export default async function* ({ ctx }: ServerRequest<Input>): ServerResponse<Output> {
  const billingClientCtx: BillingClientContext = {
    kubeClient: ctx.kube.client['karmada'],
    qontoClient: ctx.billing.client['qonto'],
    qontoClientId: ctx.billing.qontoClientId ?? '',
    userId: ctx.auth.user.id,
  }

  const client = await getBillingClient(billingClientCtx)
  
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
