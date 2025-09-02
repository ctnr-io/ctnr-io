import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'

export const Meta = {
}

export const Input = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export type Input = z.infer<typeof Input>

export type Output = {
  payments: Array<{
    id: string
    amount: {
      value: string
      currency: string
    }
    description: string
    status: string
    createdAt: string
    paidAt?: string
    metadata?: {
      credits?: string
    }
  }>
  total: number
}

export default async function* GetPayments({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {
  yield `Fetching payment history...`

  try {
    // Get payments from Mollie for the current user
    const paymentsResponse = await ctx.billing.client.customerPayments.page({
      limit: input.limit,
      from: input.offset.toString(),
      customerId: ctx.billing.customerId,
    })

    // Filter payments for current user based on metadata
    const userPayments = paymentsResponse.filter((payment: any) => 
      payment.metadata?.userId === ctx.auth.user.id
    )

    const formattedPayments = userPayments.map((payment: any) => ({
      id: payment.id,
      amount: {
        value: payment.amount.value,
        currency: payment.amount.currency,
      },
      description: payment.description || '',
      status: payment.status,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt || undefined,
      metadata: {
        credits: payment.metadata?.credits,
      },
    }))

    return {
      payments: formattedPayments,
      total: userPayments.length,
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch payments: ${error.message}`)
  }
}
