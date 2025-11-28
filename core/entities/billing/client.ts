/**
 * Billing Client DTO
 * Represents billing/invoicing client information (from Qonto)
 */
import { z } from 'zod'

/**
 * Client type
 */
export const BillingClientTypeSchema = z.enum(['individual', 'company'])
export type BillingClientType = z.infer<typeof BillingClientTypeSchema>

/**
 * Billing address
 */
export const BillingAddressSchema = z.object({
  streetAddress: z.string(),
  city: z.string(),
  postalCode: z.string(),
  countryCode: z.string(),
  provinceCode: z.string().optional(),
})
export type BillingAddress = z.infer<typeof BillingAddressSchema>

/**
 * Currency (only EUR for now)
 */
export const CurrencySchema = z.enum(['EUR'])
export type Currency = z.infer<typeof CurrencySchema>

/**
 * Locale
 */
export const LocaleSchema = z.enum(['fr'])
export type Locale = z.infer<typeof LocaleSchema>

/**
 * Individual client
 */
export const IndividualClientSchema = z.object({
  type: z.literal('individual'),
  firstName: z.string(),
  lastName: z.string(),
})
export type IndividualClient = z.infer<typeof IndividualClientSchema>

/**
 * Company client
 */
export const CompanyClientSchema = z.object({
  type: z.literal('company'),
  name: z.string(),
  taxIdentificationNumber: z.string(),
  vatNumber: z.string().optional(),
})
export type CompanyClient = z.infer<typeof CompanyClientSchema>

/**
 * Full Billing Client schema
 */
export const BillingClientSchema = z.discriminatedUnion('type', [
  IndividualClientSchema.extend({
    currency: CurrencySchema,
    locale: LocaleSchema,
    billingAddress: BillingAddressSchema,
  }),
  CompanyClientSchema.extend({
    currency: CurrencySchema,
    locale: LocaleSchema,
    billingAddress: BillingAddressSchema,
  }),
])
export type BillingClient = z.infer<typeof BillingClientSchema>

/**
 * Billing Client summary (same as full for now)
 */
export const BillingClientSummarySchema = BillingClientSchema
export type BillingClientSummary = BillingClient

/**
 * Create billing client input
 */
export const CreateBillingClientInputSchema = BillingClientSchema
export type CreateBillingClientInput = z.infer<typeof CreateBillingClientInputSchema>

/**
 * Update billing client input (same as create for discriminated union)
 */
export const UpdateBillingClientInputSchema = BillingClientSchema
export type UpdateBillingClientInput = z.infer<typeof UpdateBillingClientInputSchema>
