import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { PaymentMetadataV1 } from 'lib/billing/utils.ts'
import { match } from 'ts-pattern'
import { PaymentStatus } from '@mollie/api-client'

export const Meta = {}

export const Input = z.object({
  from: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
})

export type Input = z.infer<typeof Input>

export type Output = Array<{
  id: string
  amount: {
    value: string
    currency: string
  }
  description: string
  status: 'paid' | 'pending' | 'failed'
  createdAt: string
  paidAt?: string
  expiredAt?: string
  credits: number
  downloadUrl?: string
}>

export default async function* GetInvoices({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {
  const userPayments = []
  const iterator =  ctx.billing.client['mollie'].customerPayments.iterate({
    customerId: ctx.billing.mollieCustomerId,
  })
  for await (const payment of iterator) {
    userPayments.push(payment)
  }
  console.log(userPayments)
  const invoices = userPayments.map((payment): Output[number] => {
    // Check metadata is ok
    const metadata = payment.metadata as PaymentMetadataV1
    return ({
      id: payment.id,
      amount: {
        value: payment.amount.value,
        currency: payment.amount.currency,
      },
      description: payment.description,
      status: match(payment.status)
        .with(PaymentStatus.open, () => 'pending' as const)
        .with(PaymentStatus.canceled, () => 'failed' as const)
        .with(PaymentStatus.pending, () => 'pending' as const)
        .with(PaymentStatus.authorized, () => 'pending' as const)
        .with(PaymentStatus.expired, () => 'failed' as const)
        .with(PaymentStatus.failed, () => 'failed' as const)
        .with(PaymentStatus.paid, () => 'paid' as const)
        .exhaustive(),
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      expiredAt: payment.expiredAt,
      credits: metadata.credits,
      downloadUrl: metadata.invoiceUrl ?? undefined,
    })
  })

  return invoices
}
