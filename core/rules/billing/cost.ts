import { DEFAULT_RATES } from './rates.ts'
import { parseResourceToPrimitiveValue } from './resource.ts'
import { FreeTier } from './utils.ts'

export interface CostRates {
  cpuPerHour: number // cost per CPU core per hour in credits
  memoryPerHour: number // cost per GB per hour in credits
  storagePerHour: number // cost per GB per hour in credits
}

/**
 * Calculate cost since last billing cycle
 * @param usage
 * @returns cost in credits
 */
export function calculateTotalCostWithFreeTierSince(
  usage: { cpu: string; memory: string; storage: string },
  timestamp: number,
  rates: CostRates = DEFAULT_RATES,
): number {
  const { cpu, memory, storage } = usage
  const cost = calculateTotalCostWithFreeTier(cpu, memory, storage, rates)
  const hoursSince = (Date.now() - timestamp) / (1000 * 60 * 60)
  const costSince = cost.hourly * hoursSince
  return costSince
}

/**
 * Calculate cost per hour based on CPU, memory, and storage
 */
export function calculateTotalCostWithFreeTier(
  cpu: string,
  memory: string,
  storage: string,
  rates: CostRates = DEFAULT_RATES,
): {
  hourly: number
  daily: number
  monthly: number
} {
  // Parse resources to standardized units
  const cpuCores = parseResourceToPrimitiveValue(cpu, 'cpu') / 1000
  const memoryGB = parseResourceToPrimitiveValue(memory, 'memory') / 1024
  const storageGB = parseResourceToPrimitiveValue(storage, 'storage')

  // Free tier allowances (per replica)
  const freeTierCpuCores = parseResourceToPrimitiveValue(FreeTier.cpu, 'cpu') / 1000
  const freeTierMemoryGB = parseResourceToPrimitiveValue(FreeTier.memory, 'memory') / 1024
  const freeTierStorageGB = parseResourceToPrimitiveValue(FreeTier.storage, 'storage')

  // Calculate billable resources (subtract free tier allowances)
  const billableCpuCores = Math.max(0, cpuCores - freeTierCpuCores)
  const billableMemoryGB = Math.max(0, memoryGB - freeTierMemoryGB)
  const billableStorageGB = Math.max(0, storageGB - freeTierStorageGB)

  return calculateCost(
    `${billableCpuCores}`,
    `${billableMemoryGB}G`,
    `${billableStorageGB}G`,
    1,
    rates,
  )
}

/**
 * Calculate cost per hour based on CPU, memory, and storage
 */
function calculateCost(
  cpu: string,
  memory: string,
  storage: string,
  replicas: number = 1,
  rates: CostRates = DEFAULT_RATES,
): {
  hourly: number
  daily: number
  monthly: number
} {
  // Parse resources to standardized units
  const cpuCores = parseResourceToPrimitiveValue(cpu, 'cpu') / 1000
  const memoryGB = parseResourceToPrimitiveValue(memory, 'memory') / 1024
  const storageGB = parseResourceToPrimitiveValue(storage, 'storage')

  // Calculate base hourly cost for one replica (only for usage above free tier)
  const baseCostPerHour = (cpuCores * rates.cpuPerHour) +
    (memoryGB * rates.memoryPerHour) +
    (storageGB * rates.storagePerHour)

  // Multiply by replicas
  const hourlyCost = baseCostPerHour * replicas

  // Convert to credits (€0.01 = 1 credit)
  return {
    hourly: Math.round(hourlyCost * 100) / 100,
    daily: Math.round(hourlyCost * 24 * 100) / 100,
    monthly: Math.round(hourlyCost * 24 * 30 * 100) / 100,
  }
}
