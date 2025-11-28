import { ServerRequest, ServerResponse } from 'lib/api/types.ts'
import { z } from 'zod'
import { listInvoices, type InvoiceContext } from 'core/data/billing/invoice.ts'
import type { Invoice } from 'core/schemas/billing/invoice.ts'

export const Meta = {}

export const Input = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
})

export type Input = z.infer<typeof Input>

export type Output = Invoice[]

export default async function* GetInvoices({ ctx, input }: ServerRequest<Input>): ServerResponse<Output> {
  const invoiceCtx: InvoiceContext = {
    mollieClient: ctx.billing.client['mollie'],
    mollieCustomerId: ctx.billing.mollieCustomerId,
  }

  const invoices = await listInvoices(invoiceCtx, {
    cursor: input.cursor,
    limit: input.limit,
  })

  return invoices
}
