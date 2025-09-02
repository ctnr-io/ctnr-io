/**
 * Billing utility functions for cost calculation and resource parsing
 */

export interface ResourceParsed {
  cpu: number // in millicores
  memory: number // in MB
  storage: number // in GB
}

export interface CostRates {
  cpuPerHour: number // cost per CPU core per hour in credits
  memoryPerHour: number // cost per MB per hour in credits
  storagePerHour: number // cost per GB per hour in credits
}

// Default pricing rates (€0.01 = 1 credit)
export const DEFAULT_RATES: CostRates = {
  cpuPerHour: 0.01, // 0.01 credits per CPU core per hour (€0.01)
  memoryPerHour: 0.01, // 0.01 credits per MB per hour (€0.01)
  storagePerHour: 0.002, // 0.002 credits per GB per hour (€0.002) - more competitive storage pricing
}

/**
 * Parse Kubernetes resource values to standardized units
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
 * Calculate cost per hour based on CPU, memory, and storage
 */
export function calculateCost(
  cpu: string | number,
  memory: string | number,
  storage: string | number = 0,
  replicas: number = 1,
  rates: CostRates = DEFAULT_RATES,
): {
  hourly: number
  daily: number
  monthly: number
} {
  // Parse resources to standardized units
  const cpuMillicores = typeof cpu === 'number' ? cpu : parseResourceValue(cpu, 'cpu')
  const memoryMB = typeof memory === 'number' ? memory : parseResourceValue(memory, 'memory')
  const storageGB = typeof storage === 'number' ? storage : parseResourceValue(storage, 'storage')

  // Convert CPU millicores to cores
  const cpuCores = cpuMillicores / 1000

  // Calculate base hourly cost for one replica
  const baseCostPerHour = (cpuCores * rates.cpuPerHour) + (memoryMB * rates.memoryPerHour) +
    (storageGB * rates.storagePerHour)

  // Multiply by replicas
  const hourlyCost = baseCostPerHour * replicas

  // Convert to credits (€0.01 = 1 credit)
  return {
    hourly: parseInt(String(hourlyCost)),
    daily: parseInt(String(hourlyCost * 24)),
    monthly: parseInt(String(hourlyCost * 24 * 30)),
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
