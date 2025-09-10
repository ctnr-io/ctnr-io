/**
 * Billing utility functions for cost calculation and resource parsing
 */

import z from 'zod'
import { KubeClient } from '../kubernetes/kube-client.ts'
import { Namespace } from '@cloudydeno/kubernetes-apis/core/v1'
import { DEFAULT_RATES } from './cost.ts'

export interface ResourceParsed {
  cpu: number // in millicores
  memory: number // in MB
  storage: number // in GB
}


export const FreeTier = {
  cpu: '1G', // 1 CPU core
  memory: '2G', // 2 GB memory
  storage: '1G', // 1 GB storage
}

/**
 * Parse Kubernetes resource values to standardized units
 * - CPU: millicores (m)
 * - Memory: megabytes (MB)
 * - Storage: gigabytes (GB)
 */
export function parseResourceValue(value: string | any, type: 'cpu' | 'memory' | 'storage'): number {
  if (!value) return 0

  // Convert Kubernetes Quantity objects to string
  const stringValue = typeof value === 'string' ? value : String(value)

  // Helper function to safely parse numbers
  const safeParseInt = (str: string): number => {
    const parsed = parseInt(str, 10)
    return isNaN(parsed) ? 0 : parsed
  }

  const safeParseFloat = (str: string): number => {
    const parsed = parseFloat(str)
    return isNaN(parsed) ? 0 : parsed
  }

  switch (type) {
    case 'cpu':
      if (stringValue.endsWith('m')) {
        return safeParseInt(stringValue.slice(0, -1))
      } else if (stringValue.endsWith('n')) {
        // Handle nanocores (1 core = 1,000,000,000 nanocores)
        return Math.round(safeParseInt(stringValue.slice(0, -1)) / 1000000)
      } else {
        return Math.round(safeParseFloat(stringValue) * 1000)
      }

    case 'memory':
      if (stringValue.endsWith('Mi')) {
        return safeParseInt(stringValue.slice(0, -2))
      } else if (stringValue.endsWith('Gi')) {
        return safeParseInt(stringValue.slice(0, -2)) * 1024
      } else if (stringValue.endsWith('Ki')) {
        return Math.round(safeParseInt(stringValue.slice(0, -2)) / 1024)
      } else if (stringValue.endsWith('M')) {
        return safeParseInt(stringValue.slice(0, -1))
      } else if (stringValue.endsWith('G')) {
        return safeParseInt(stringValue.slice(0, -1)) * 1024
      } else if (stringValue.endsWith('K')) {
        return Math.round(safeParseInt(stringValue.slice(0, -1)) / 1024)
      }
      return 0

    case 'storage':
      if (stringValue.endsWith('Gi')) {
        return safeParseInt(stringValue.slice(0, -2))
      } else if (stringValue.endsWith('Mi')) {
        return Math.round(safeParseInt(stringValue.slice(0, -2)) / 1024 * 100) / 100
      } else if (stringValue.endsWith('G')) {
        return safeParseInt(stringValue.slice(0, -1))
      } else if (stringValue.endsWith('M')) {
        return Math.round(safeParseInt(stringValue.slice(0, -1)) / 1024 * 100) / 100
      }
      return 0

    default:
      return 0
  }
}

/**
 * Parse resource usage
 * - CPU: millicores (m)
 * - Memory: megabytes (MB)
 * - Storage: gigabytes (GB)
 */
export function parseResourceUsage(usage: {
  cpu: string
  memory: string
  storage: string
  replicas: number
}): ResourceParsed {
  return {
    cpu: parseResourceValue(usage.cpu, 'cpu'),
    memory: parseResourceValue(usage.memory, 'memory'),
    storage: parseResourceValue(usage.storage, 'storage'),
  }
}


export type TierLimits = {
  cpu: string // in millicores
  memory: string // in MB
  storage: string // in MB
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
  userId: z.string(),
  credits: z.number(),
  invoiceUrl: z.string().or(z.null()),
})
export type PaymentMetadataV1 = z.infer<typeof PaymentMetadataV1>

export const BillingClient = z.union([
  z.object({
    type: z.literal('individual'),
    firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  }),
  z.object({
    type: z.literal('freelance'),
    firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
    vatNumber: z.string().min(1, 'VAT number is required').max(50, 'VAT number too long'),
  }),
  z.object({
    type: z.literal('company'),
    name: z.string().min(1, 'Company name is required').max(200, 'Company name too long'),
    vatNumber: z.string().min(1, 'VAT number is required').max(50, 'VAT number too long'),
  }),
])
  .and(z.object({
    currency: z.enum(['EUR']),
    locale: z.enum(['fr']),
    billingAddress: z.object({
      streetAddress: z.string().min(1, 'Street address is required').max(200, 'Street address too long'),
      city: z.string().min(1, 'City is required').max(100, 'City name too long'),
      postalCode: z.string().min(1, 'Postal code is required').max(20, 'Postal code too long'),
      provinceCode: z.string().max(10, 'Province code too long').optional(),
      countryCode: z.string().min(2, 'Country code must be at least 2 characters').max(3, 'Country code too long'),
    }).refine((data) => {
      // Province code is required only for Italian addresses
      if (data.countryCode === 'IT') {
        return data.provinceCode && data.provinceCode.trim().length > 0
      }
      return true
    }, {
      message: 'Province code is required for Italian addresses',
      path: ['provinceCode'],
    }),
  }))

export type BillingClient = z.infer<typeof BillingClient>

export interface Invoice {
  id: string
  number: string
  amount: {
    value: string
    currency: string
  }
  description: string
  status: 'paid' | 'pending' | 'failed' | 'draft'
  createdAt: string
  paidAt?: string
  dueAt: string
  credits: number
  downloadUrl?: string
}

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
    min: parseResourceValue(FreeTier.cpu, 'cpu') / 1000, // in cores
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
    fromString: (value: string) => parseResourceValue(value, 'cpu') / 1000,
  },
  memory: {
    min: parseResourceValue(FreeTier.memory, 'memory') / 1000,
    max: 128, // 128 GB
    step: 0.01,
    price: DEFAULT_RATES.memoryPerHour,
    format: (value: number) => `${value}G`,
    display: (value: number) => `${value} GB`,
    toSlider: (value: number) => logScale(value, ResourceLimits.memory.min, ResourceLimits.memory.max),
    fromSlider: (sliderValue: number) => {
      const rawValue = expScale(sliderValue, ResourceLimits.memory.min, ResourceLimits.memory.max)
      // Round to nearest 1 for cleaner values
      return Math.round(rawValue)
    },
    fromString: (value: string) => parseResourceValue(value, 'memory') / 1000,
  },
  storage: {
    min: 1, // 1 GB
    max: 1024, // 1 TB
    step: 0.01,
    price: DEFAULT_RATES.storagePerHour,
    format: (value: number) => value >= 1000 ? `${value}T` : `${value}G`,
    display: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)} TB` : `${value} GB`,
    toSlider: (value: number) => logScale(value, ResourceLimits.storage.min, ResourceLimits.storage.max),
    fromSlider: (sliderValue: number) => {
      const rawValue = expScale(sliderValue, ResourceLimits.storage.min, ResourceLimits.storage.max)
      // Round to nearest 1 for cleaner values
      return Math.round(rawValue)
    },
    fromString: (value: string) => parseResourceValue(value, 'storage'),
  },
}
