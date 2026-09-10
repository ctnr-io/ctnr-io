// Ambient bridges for bare `core/*` and `api/*` specifiers tsc's Node resolver cannot follow.
// `export *` silently re-exports nothing here; named re-exports are required.
declare module 'core/schemas/mod.ts' {
  export { Container, ContainerInstance, ContainerPort, Volume } from '../../core/schemas/mod.ts'
}

declare module 'core/schemas/network/route.ts' {
  export { Route } from '../../core/schemas/network/route.ts'
}

declare module 'api/drivers/errors.ts' {
  export { ClientAuthError, ClientVersionError } from '../../api/drivers/errors.ts'
}

declare module 'core/rules/billing/rates.ts' {
  export { DEFAULT_RATES } from '../../core/rules/billing/rates.ts'
}

declare module 'core/rules/billing/country_codes.ts' {
  export { CountryCodes } from '../../core/rules/billing/country_codes.ts'
}

// Hand-authored: real file imports 'core/rules/billing/resource.ts' by bare specifier, not re-exportable as-is.
declare module 'core/rules/billing/utils.ts' {
  export const FreeTier: { cpu: string; memory: string; storage: string }

  // Real source exports BillingClient as both a zod schema (value) and its inferred type.
  import { z } from 'zod'
  export const BillingClient: z.ZodType<BillingClient>

  export type BillingClient = {
    type: 'individual' | 'company'
    firstName?: string
    lastName?: string
    name?: string
    taxIdentificationNumber?: string
    vatNumber?: string
    currency: 'EUR'
    locale: 'fr'
    billingAddress: {
      streetAddress: string
      city: string
      postalCode: string
      countryCode: string
      provinceCode?: string
    }
  }

  interface ResourceLimit {
    min: number
    max: number
    step: number
    price: number
    format: (value: number) => string
    display: (value: number) => string
    toSlider: (value: number) => number
    fromSlider: (value: number) => number
    fromString: (value: string) => number
  }

  export const ResourceLimits: {
    cpu: ResourceLimit
    memory: ResourceLimit
    storage: ResourceLimit
  }
}

// Hand-authored: real file imports 'core/rules/billing/resource.ts' and './rates.ts' by bare specifier.
declare module 'core/rules/billing/cost.ts' {
  export interface CostRates {
    cpuPerHour: number
    memoryPerHour: number
    storagePerHour: number
  }

  export function calculateTotalCost(
    cpu: string,
    memory: string,
    storage: string,
    rates?: CostRates,
  ): { hourly: number; daily: number; monthly: number }
}
