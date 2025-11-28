/**
 * Resource quantity parsing utilities
 * Converts Kubernetes resource quantities to standardized primitive values
 */

/**
 * Normalize a Kubernetes resource value to a string
 * Handles both string and structured formats like {number: 250, suffix: "m"}
 */
export function normalizeQuantity(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (typeof obj.number !== 'undefined' && typeof obj.suffix !== 'undefined') {
      return `${obj.number}${obj.suffix}`
    }
    // Handle serialize() method from kubernetes APIs
    if (typeof obj.serialize === 'function') {
      return (obj as { serialize: () => string }).serialize()
    }
    return JSON.stringify(value)
  }

  return String(value ?? '')
}

/**
 * Parse CPU quantity to millicores
 * Examples: "250m" -> 250, "1" -> 1000, "0.5" -> 500, "100n" -> 0
 */
export function parseCpuToMillicores(value: string | unknown): number {
  const str = normalizeQuantity(value)
  if (!str) return 0

  if (str.endsWith('m')) {
    return safeParseInt(str.slice(0, -1))
  }
  if (str.endsWith('n')) {
    // nanocores to millicores (1m = 1,000,000n)
    return Math.round(safeParseInt(str.slice(0, -1)) / 1_000_000)
  }
  if (str.endsWith('u')) {
    // microcores to millicores (1m = 1,000u)
    return Math.round(safeParseInt(str.slice(0, -1)) / 1_000)
  }

  // Plain number means cores
  return Math.round(safeParseFloat(str) * 1000)
}

/**
 * Parse memory quantity to megabytes (MB)
 * Examples: "512Mi" -> 512, "1Gi" -> 1024, "256M" -> 256
 */
export function parseMemoryToMB(value: string | unknown): number {
  const str = normalizeQuantity(value)
  if (!str) return 0

  // Binary units (Ki, Mi, Gi, Ti)
  if (str.endsWith('Ki')) {
    return Math.round(safeParseFloat(str.slice(0, -2)) / 1024)
  }
  if (str.endsWith('Mi')) {
    return safeParseFloat(str.slice(0, -2))
  }
  if (str.endsWith('Gi')) {
    return safeParseFloat(str.slice(0, -2)) * 1024
  }
  if (str.endsWith('Ti')) {
    return safeParseFloat(str.slice(0, -2)) * 1024 * 1024
  }

  // Decimal units (K, M, G, T)
  if (str.endsWith('K')) {
    return Math.round(safeParseFloat(str.slice(0, -1)) / 1000)
  }
  if (str.endsWith('M')) {
    return safeParseFloat(str.slice(0, -1))
  }
  if (str.endsWith('G')) {
    return safeParseFloat(str.slice(0, -1)) * 1000
  }
  if (str.endsWith('T')) {
    return safeParseFloat(str.slice(0, -1)) * 1000 * 1000
  }

  // Plain bytes
  return Math.round(safeParseFloat(str) / (1024 * 1024))
}

/**
 * Parse storage quantity to gigabytes (GB)
 * Examples: "10Gi" -> 10, "500Mi" -> 0.49, "1Ti" -> 1024
 */
export function parseStorageToGB(value: string | unknown): number {
  const str = normalizeQuantity(value)
  if (!str) return 0

  // Binary units (Ki, Mi, Gi, Ti)
  if (str.endsWith('Ki')) {
    return Math.round(safeParseFloat(str.slice(0, -2)) / (1024 * 1024) * 100) / 100
  }
  if (str.endsWith('Mi')) {
    return Math.round(safeParseFloat(str.slice(0, -2)) / 1024 * 100) / 100
  }
  if (str.endsWith('Gi')) {
    return safeParseFloat(str.slice(0, -2))
  }
  if (str.endsWith('Ti')) {
    return safeParseFloat(str.slice(0, -2)) * 1024
  }

  // Decimal units (K, M, G, T)
  if (str.endsWith('K')) {
    return Math.round(safeParseFloat(str.slice(0, -1)) / (1000 * 1000) * 100) / 100
  }
  if (str.endsWith('M')) {
    return Math.round(safeParseFloat(str.slice(0, -1)) / 1000 * 100) / 100
  }
  if (str.endsWith('G')) {
    return safeParseFloat(str.slice(0, -1))
  }
  if (str.endsWith('T')) {
    return safeParseFloat(str.slice(0, -1)) * 1000
  }

  // Plain bytes
  return Math.round(safeParseFloat(str) / (1024 * 1024 * 1024) * 100) / 100
}

/**
 * Format millicores back to Kubernetes format
 */
export function formatMillicores(millicores: number): string {
  if (millicores >= 1000 && millicores % 1000 === 0) {
    return `${millicores / 1000}`
  }
  return `${millicores}m`
}

/**
 * Format megabytes back to Kubernetes format
 */
export function formatMemoryMB(mb: number): string {
  if (mb >= 1024 && mb % 1024 === 0) {
    return `${mb / 1024}Gi`
  }
  return `${mb}Mi`
}

/**
 * Format gigabytes back to Kubernetes format
 */
export function formatStorageGB(gb: number): string {
  if (gb >= 1024 && gb % 1024 === 0) {
    return `${gb / 1024}Ti`
  }
  return `${gb}Gi`
}

/**
 * Parsed resource quantities in primitive values
 */
export interface ParsedResources {
  cpu: number // millicores
  memory: number // MB
  storage: number // GB
}

/**
 * Parse all resource quantities at once
 */
export function parseResources(resources: {
  cpu?: string | unknown
  memory?: string | unknown
  storage?: string | unknown
}): ParsedResources {
  return {
    cpu: parseCpuToMillicores(resources.cpu),
    memory: parseMemoryToMB(resources.memory),
    storage: parseStorageToGB(resources.storage),
  }
}

// Helper functions
function safeParseInt(str: string): number {
  const parsed = parseInt(str, 10)
  return isNaN(parsed) ? 0 : parsed
}

function safeParseFloat(str: string): number {
  const parsed = parseFloat(str)
  return isNaN(parsed) ? 0 : parsed
}
