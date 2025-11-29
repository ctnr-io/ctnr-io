import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { InvoiceRepository } from 'core/repositories/mod.ts'
import type { Invoice } from 'core/entities/billing/invoice.ts'

export const Meta = {}

export const Input = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
})

export type Input = z.infer<typeof Input>

export type Output = Invoice[]

export default async function* GetInvoices({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {
  const invoiceRepository = new InvoiceRepository(
    ctx.billing.client['mollie'],
    ctx.billing.mollieCustomerId,
  )

  const invoices = await invoiceRepository.list({
    cursor: input.cursor,
    limit: input.limit,
  })

  return invoices
}
