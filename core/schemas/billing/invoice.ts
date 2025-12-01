/**
 * Invoice DTO
 * Represents a payment/invoice from the billing system (Mollie)
 */
import { z } from 'zod'

/**
 * Invoice status
 */
export const InvoiceStatusSchema = z.enum(['paid', 'pending', 'failed'])
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>

/**
 * Invoice amount
 */
export const InvoiceAmountSchema = z.object({
  value: z.string(),
  currency: z.string(),
})
export type InvoiceAmount = z.infer<typeof InvoiceAmountSchema>

/**
 * Full Invoice schema
 */
export const InvoiceSchema = z.object({
  id: z.string(),
  amount: InvoiceAmountSchema,
  description: z.string(),
  status: InvoiceStatusSchema,
  createdAt: z.string(),
  paidAt: z.string().optional(),
  expiredAt: z.string().optional(),
  credits: z.number(),
  downloadUrl: z.string().optional(),
})
export type Invoice = z.infer<typeof InvoiceSchema>

/**
 * Invoice summary (same as full for now)
 */
export const InvoiceSummarySchema = InvoiceSchema
export type InvoiceSummary = Invoice
