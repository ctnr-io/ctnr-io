/**
 * Billing utility functions for cost calculation and resource parsing
 */

import z from 'zod'
import { parseResourceToPrimitiveValue } from './resource.ts'
import { DEFAULT_RATES } from './rates.ts'

export const FreeTier = {
  cpu: '1', // 1 CPU core
  memory: '2Gi', // 2 Gi memory
  storage: '5Gi', // 5 Gi storage
}

export type TierLimits = {
  cpu: string // in millicores
  memory: string // in Gi
  storage: string // in Gi
  monthlyCreditCost: number // in credits
}

const units = {
  cpu: '1',
  memory: '2Gi',
  storage: '4Gi',
  monthlyCreditCost: 500,
}
const freeTier = {
  ...units,
  monthlyCreditCost: 0,
}

export const Tier = {
  'free': freeTier,
} satisfies Record<
  string,
  TierLimits
>

export type Tier = keyof typeof Tier

export const PaymentMetadataV1 = z.object({
  version: z.literal(1),
  ownerId: z.string(),
  projectId: z.string(),
  credits: z.number(),
  invoiceUrl: z.string().or(z.null()),
})
export type PaymentMetadataV1 = z.infer<typeof PaymentMetadataV1>

export const PaymentMetadataV2 = PaymentMetadataV1.omit({ version: true }).extend({
  version: z.literal(2),
  token: z.string(),
})

export const PaymentMetadata = z.union([PaymentMetadataV1, PaymentMetadataV2])
export type PaymentMetadata = z.infer<typeof PaymentMetadata>

const BillingAddressBase = z.object({
  streetAddress: z.string().min(1, 'Street address is required').max(200, 'Street address too long'),
  city: z.string().min(1, 'City is required').max(100, 'City name too long'),
  postalCode: z.string().min(1, 'Postal code is required').max(20, 'Postal code too long'),
  countryCode: z.string().min(2, 'Country code must be at least 2 characters').max(3, 'Country code too long'),
  provinceCode: z.string().max(10, 'Province code too long').optional(),
})
const BillingAddress = z.union([
  BillingAddressBase,
  BillingAddressBase.and(z.object({
    // Province code is required only for Italian addresses
    postalCode: z.string().min(1, 'Postal code is required').max(5, 'Postal code too long'),
    countryCode: z.literal('IT'),
    provinceCode: z.string().min(1, 'Province code is required for Italian addresses').max(
      10,
      'Province code too long',
    ),
  })),
])

const BillingClientBase = z.object({
  type: z.enum(['individual', 'company']),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional(),
  name: z.string().min(1, 'Company name is required').max(200, 'Company name too long').optional(),
  taxIdentificationNumber: z.string().min(1, 'Tax ID is required').max(50, 'Tax ID too long').optional(),
  vatNumber: z.string().min(0, 'VAT number is required').max(50, 'VAT number too long').optional(),
  currency: z.enum(['EUR']),
  locale: z.enum(['fr']),
  billingAddress: BillingAddressBase,
})

export const BillingClient = z.union([
  z.object({
    type: z.literal('individual'),
    firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  }),
  z.object({
    type: z.literal('company'),
    name: z.string().min(1, 'Company name is required').max(200, 'Company name too long'),
    taxIdentificationNumber: z.string().min(1, 'Tax ID is required').max(50, 'Tax ID too long'),
    vatNumber: z.string().min(0, 'VAT number is required').max(50, 'VAT number too long').optional(),
  }),
])
  .and(z.object({
    currency: z.enum(['EUR']),
    locale: z.enum(['fr']),
    billingAddress: BillingAddress,
  }))

export type BillingClient = z.infer<typeof BillingClientBase>

// Logarithmic scaling functions
const logScale = (value: number, min: number, max: number): number => {
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  return (Math.log(value) - logMin) / (logMax - logMin) * 100
}

const expScale = (sliderValue: number, min: number, max: number): number => {
  const logMin = Math.log(min)
  const logMax = Math.log(max)
  const logValue = logMin + (sliderValue / 100) * (logMax - logMin)
  return Math.round(Math.exp(logValue))
}

// Resource limits configuration with logarithmic scaling
export const ResourceLimits = {
  cpu: {
    min: parseResourceToPrimitiveValue(FreeTier.cpu, 'cpu') / 1000, // in cores
    max: 72, // 72 CPUs
    step: 0.1,
    price: DEFAULT_RATES.cpuPerHour,
    format: (value: number) => `${value}`,
    display: (value: number) => `${value.toFixed(0)} CPU${value >= 2 ? 's' : ''}`,
    toSlider: (value: number) => logScale(value, ResourceLimits.cpu.min, ResourceLimits.cpu.max),
    fromSlider: (sliderValue: number) => {
      const rawValue = expScale(sliderValue, ResourceLimits.cpu.min, ResourceLimits.cpu.max)
      // Round to nearest 1000 for cleaner values
      return rawValue
    },
    fromString: (value: string) => parseResourceToPrimitiveValue(value, 'cpu') / 1000,
  },
  memory: {
    min: parseResourceToPrimitiveValue(FreeTier.memory, 'memory') / 1024,
    max: 128, // 128 Gi
    step: 0.01,
    price: DEFAULT_RATES.memoryPerHour,
    format: (value: number) => `${value}Gi`,
    display: (value: number) => `${value} Gi`,
    toSlider: (value: number) => logScale(value, ResourceLimits.memory.min, ResourceLimits.memory.max),
    fromSlider: (sliderValue: number) => {
      const rawValue = expScale(sliderValue, ResourceLimits.memory.min, ResourceLimits.memory.max)
      // Round to nearest 1 for cleaner values
      return Math.round(rawValue)
    },
    fromString: (value: string) => parseResourceToPrimitiveValue(value, 'memory') / 1000,
  },
  storage: {
    min: parseResourceToPrimitiveValue(FreeTier.storage, 'storage'), // 1 Gi
    max: 1024, // 1 Ti
    step: 0.01,
    price: DEFAULT_RATES.storagePerHour,
    format: (value: number) => value >= 1000 ? `${value}Ti` : `${value}Gi`,
    display: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)} Ti` : `${value} Gi`,
    toSlider: (value: number) => logScale(value, ResourceLimits.storage.min, ResourceLimits.storage.max),
    fromSlider: (sliderValue: number) => {
      const rawValue = expScale(sliderValue, ResourceLimits.storage.min, ResourceLimits.storage.max)
      // Round to nearest 1 for cleaner values
      return Math.round(rawValue)
    },
    fromString: (value: string) => parseResourceToPrimitiveValue(value, 'storage'),
  },
}
