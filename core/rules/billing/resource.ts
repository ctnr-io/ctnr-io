import { Pod } from 'infra/kubernetes/types/core.ts'

export type ResourceUsage = {
  cpu: string
  memory: string
  storage: string
}

export interface ResourceParsed {
  cpu: number // in millicores
  memory: number // in MiB
  storage: number // in Gi
}

export function extractPodResourceUsage(pod: Pod): ResourceUsage {
  const resources = pod.spec?.containers?.[0]?.resources
  const cpu = resources?.limits?.cpu || resources?.requests?.cpu || '250m'
  const memory = resources?.limits?.memory || resources?.requests?.memory || '512M'
  const ephemeralStorage = resources?.limits?.['ephemeral-storage'] || resources?.requests?.['ephemeral-storage'] ||
    '1G'
  const storage = parseResourceToPrimitiveValue(ephemeralStorage, 'storage') / 3 + 'G'
  const totalCpu = parseResourceToPrimitiveValue(cpu, 'cpu')
  const totalMemory = parseResourceToPrimitiveValue(memory, 'memory')
  const totalStorage = parseResourceToPrimitiveValue(storage, 'storage')
  return { cpu: totalCpu + 'm', memory: totalMemory + 'MiB', storage: totalStorage + 'Gi' }
}

/**
 * Parse resource usage
 * - CPU: millicores (m)
 * - Memory: megabytes (MiB)
 * - Storage: gigabytes (Gi)
 */
export function parseResourceUsageToPrimitiveValues(usage: {
  cpu: string
  memory: string
  storage: string
}): ResourceParsed {
  return {
    cpu: parseResourceToPrimitiveValue(usage.cpu, 'cpu'),
    memory: parseResourceToPrimitiveValue(usage.memory, 'memory'),
    storage: parseResourceToPrimitiveValue(usage.storage, 'storage'),
  }
}

/**
 * Parse Kubernetes resource values to standardized units
 * - CPU: millicores (m)
 * - Memory: mebibytes (Mi)
 * - Storage: gibibytes (Gi)
 */
export function parseResourceToPrimitiveValue(
  value: string,
  type: 'cpu' | 'memory' | 'storage',
): number {
  if (!value) return 0

  const stringValue = String(value).trim()

  const safeParseInt = (str: string): number => {
    const parsed = parseInt(str, 10)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  const safeParseFloat = (str: string): number => {
    const parsed = parseFloat(str)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  switch (type) {
    case 'cpu': {
      // target: millicores
      if (stringValue.endsWith('m')) {
        return safeParseInt(stringValue.slice(0, -1))
      }
      if (stringValue.endsWith('u')) {
        // microcores: 1 core = 1e6 u, 1 core = 1000m -> 1m = 1000u
        return Math.round(safeParseFloat(stringValue.slice(0, -1)) / 1000)
      }
      if (stringValue.endsWith('n')) {
        // nanocores: 1 core = 1e9 n, 1 core = 1000m -> 1m = 1e6n
        return Math.round(safeParseFloat(stringValue.slice(0, -1)) / 1_000_000)
      }

      // bare value: cores
      return Math.round(safeParseFloat(stringValue) * 1000)
    }

    case 'memory': {
      // target: Mi (mebibytes)

      // binary suffixes
      if (stringValue.endsWith('Mi') || stringValue.endsWith('MiB')) {
        return safeParseFloat(stringValue.replace(/MiB?$/, ''))
      }
      if (stringValue.endsWith('Gi') || stringValue.endsWith('GiB')) {
        return safeParseFloat(stringValue.replace(/GiB?$/, '')) * 1024
      }
      if (stringValue.endsWith('Ki') || stringValue.endsWith('KiB')) {
        return Math.round(
          safeParseFloat(stringValue.replace(/KiB?$/, '')) / 1024,
        )
      }

      // decimal suffixes (base 1000) converted to binary MiB
      if (stringValue.endsWith('MB')) {
        // 1 MB = 1,000,000 bytes, 1 MiB = 1,048,576 bytes
        return safeParseFloat(stringValue.slice(0, -2)) * (1_000_000 / (1024 * 1024))
      }
      if (stringValue.endsWith('M')) {
        return safeParseFloat(stringValue.slice(0, -1)) * (1_000_000 / (1024 * 1024))
      }
      if (stringValue.endsWith('GB')) {
        // 1 GB = 1,000,000,000 bytes, 1 MiB = 1,048,576 bytes
        return safeParseFloat(stringValue.slice(0, -2)) * (1_000_000_000 / (1024 * 1024))
      }
      if (stringValue.endsWith('G')) {
        return safeParseFloat(stringValue.slice(0, -1)) * (1_000_000_000 / (1024 * 1024))
      }
      if (stringValue.endsWith('KB')) {
        // 1 KB = 1,000 bytes, 1 MiB = 1,048,576 bytes
        return safeParseFloat(stringValue.slice(0, -2)) * (1000 / (1024 * 1024))
      }
      if (stringValue.endsWith('K')) {
        return safeParseFloat(stringValue.slice(0, -1)) * (1000 / (1024 * 1024))
      }

      // bare: bytes -> Mi
      if (/^\d+(\.\d+)?$/.test(stringValue)) {
        return safeParseFloat(stringValue) / (1024 * 1024)
      }

      return 0
    }

    case 'storage': {
      // target: Gi (gibibytes)

      // binary suffixes
      if (stringValue.endsWith('Ti') || stringValue.endsWith('TiB')) {
        return safeParseFloat(stringValue.replace(/TiB?$/, '')) * 1024
      }
      if (stringValue.endsWith('Gi') || stringValue.endsWith('GiB')) {
        return safeParseFloat(stringValue.replace(/GiB?$/, ''))
      }
      if (stringValue.endsWith('Mi') || stringValue.endsWith('MiB')) {
        return safeParseFloat(stringValue.replace(/MiB?$/, '')) / 1024
      }

      // decimal suffixes (base 1000) converted to binary GiB
      if (stringValue.endsWith('TB')) {
        // 1 TB = 1e12 bytes, 1 GiB = 1,073,741,824 bytes
        return safeParseFloat(stringValue.slice(0, -2)) * (1_000_000_000_000 / (1024 * 1024 * 1024))
      }
      if (stringValue.endsWith('T')) {
        return safeParseFloat(stringValue.slice(0, -1)) * (1_000_000_000_000 / (1024 * 1024 * 1024))
      }
      if (stringValue.endsWith('GB')) {
        // 1 GB = 1e9 bytes, 1 GiB = 1,073,741,824 bytes
        return safeParseFloat(stringValue.slice(0, -2)) * (1_000_000_000 / (1024 * 1024 * 1024))
      }
      if (stringValue.endsWith('G')) {
        return safeParseFloat(stringValue.slice(0, -1)) * (1_000_000_000 / (1024 * 1024 * 1024))
      }
      if (stringValue.endsWith('MB')) {
        // 1 MB = 1e6 bytes, 1 GiB = 1,073,741,824 bytes
        return safeParseFloat(stringValue.slice(0, -2)) * (1_000_000 / (1024 * 1024 * 1024))
      }
      if (stringValue.endsWith('M')) {
        return safeParseFloat(stringValue.slice(0, -1)) * (1_000_000 / (1024 * 1024 * 1024))
      }

      // bare: bytes -> Gi
      if (/^\d+(\.\d+)?$/.test(stringValue)) {
        return safeParseFloat(stringValue) / (1024 * 1024 * 1024)
      }

      return 0
    }

    default:
      return 0
  }
}
