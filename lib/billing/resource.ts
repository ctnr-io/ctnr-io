import { Deployment } from '@cloudydeno/kubernetes-apis/apps/v1'

export type ResourceUsage = {
  cpu: string
  memory: string
  storage: string
  replicas: number
}

export interface ResourceParsed {
  cpu: number // in millicores
  memory: number // in MB
  storage: number // in GB
}

export function extractDeploymentMinimumResourceUsage(deployment: Deployment): ResourceUsage {
  const resources = deployment.spec?.template?.spec?.containers?.[0]?.resources
  const cpu = resources?.limits?.cpu.serialize() || resources?.requests?.cpu.serialize() || '250m'
  const memory = resources?.limits?.memory.serialize() || resources?.requests?.memory.serialize() || '512M'
  const ephemeralStorage = resources?.limits?.['ephemeral-storage']?.serialize() || resources?.requests?.['ephemeral-storage']?.serialize() || '1G'
  const storage = parseResourceToPrimitiveValue(ephemeralStorage, 'storage') / 3 + 'G'
  const annotations = deployment.metadata?.annotations || {}
  const minReplicas = parseInt(annotations['ctnr.io/min-replicas'] || '1', 10)
  const totalCpu = parseResourceToPrimitiveValue(cpu, 'cpu') * minReplicas
  const totalMemory = parseResourceToPrimitiveValue(memory, 'memory') * minReplicas
  const totalStorage = parseResourceToPrimitiveValue(storage, 'storage') * minReplicas
  return { cpu: totalCpu + 'm', memory: totalMemory + 'M', storage: totalStorage + 'G', replicas: minReplicas }
}

export function extractDeploymentMaximumResourceUsage(deployment: Deployment): ResourceUsage {
  const resources = deployment.spec?.template?.spec?.containers?.[0]?.resources
  const cpu = resources?.limits?.cpu.serialize() || resources?.requests?.cpu.serialize() || '250m'
  const memory = resources?.limits?.memory.serialize() || resources?.requests?.memory.serialize() || '512M'
  const ephemeralStorage = resources?.limits?.['ephemeral-storage']?.serialize() || resources?.requests?.['ephemeral-storage']?.serialize() || '1G'
  const storage = parseResourceToPrimitiveValue(ephemeralStorage, 'storage') / 3 + 'G'
  const annotations = deployment.metadata?.annotations || {}
  const maxReplicas = parseInt(annotations['ctnr.io/max-replicas'] || '1', 10)
  const totalCpu = parseResourceToPrimitiveValue(cpu, 'cpu') * maxReplicas
  const totalMemory = parseResourceToPrimitiveValue(memory, 'memory') * maxReplicas
  const totalStorage = parseResourceToPrimitiveValue(storage, 'storage') * maxReplicas
  return { cpu: totalCpu + 'm', memory: totalMemory + 'M', storage: totalStorage + 'G', replicas: maxReplicas }
}

export function extractDeploymentCurrentResourceUsage(deployment: Deployment): ResourceUsage {
  const resources = deployment.spec?.template?.spec?.containers?.[0]?.resources
  const cpu = resources?.limits?.cpu.serialize() || resources?.requests?.cpu.serialize() || '250m'
  const memory = resources?.limits?.memory.serialize() || resources?.requests?.memory.serialize() || '512M'
  const ephemeralStorage = resources?.limits?.['ephemeral-storage']?.serialize() || resources?.requests?.['ephemeral-storage']?.serialize() || '1G'
  const storage = parseResourceToPrimitiveValue(ephemeralStorage, 'storage') / 3 + 'G'
  const currentReplicas = deployment.status?.readyReplicas ?? deployment.status?.availableReplicas ?? 0
  const totalCpu = parseResourceToPrimitiveValue(cpu, 'cpu') * currentReplicas
  const totalMemory = parseResourceToPrimitiveValue(memory, 'memory') * currentReplicas
  const totalStorage = parseResourceToPrimitiveValue(storage, 'storage') * currentReplicas
  return { cpu: totalCpu + 'm', memory: totalMemory + 'M', storage: totalStorage + 'G', replicas: currentReplicas }
}

export function extractDeploymentResourceUsage(
  deployment: Deployment,
): { min: ResourceUsage; max: ResourceUsage; current: ResourceUsage } {
  return {
    min: extractDeploymentMinimumResourceUsage(deployment),
    max: extractDeploymentMaximumResourceUsage(deployment),
    current: extractDeploymentCurrentResourceUsage(deployment),
  }
}

/**
 * Parse resource usage
 * - CPU: millicores (m)
 * - Memory: megabytes (MB)
 * - Storage: gigabytes (GB)
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
 * - Memory: megabytes (MB)
 * - Storage: gigabytes (GB)
 */
export function parseResourceToPrimitiveValue(value: string, type: 'cpu' | 'memory' | 'storage'): number {
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
        return safeParseFloat(stringValue.slice(0, -2))
      } else if (stringValue.endsWith('Gi')) {
        return safeParseFloat(stringValue.slice(0, -2)) * 1024
      } else if (stringValue.endsWith('Ki')) {
        return Math.round(safeParseFloat(stringValue.slice(0, -2)) / 1024)
      } else if (stringValue.endsWith('M')) {
        return safeParseFloat(stringValue.slice(0, -1))
      } else if (stringValue.endsWith('G')) {
        return safeParseFloat(stringValue.slice(0, -1)) * 1024
      } else if (stringValue.endsWith('K')) {
        return Math.round(safeParseFloat(stringValue.slice(0, -1)) / 1024)
      }
      return 0

    case 'storage':
      if (stringValue.endsWith('Gi')) {
        return safeParseFloat(stringValue.slice(0, -2))
      } else if (stringValue.endsWith('Mi')) {
        return Math.round(safeParseFloat(stringValue.slice(0, -2)) / 1024 * 100) / 100
      } else if (stringValue.endsWith('G')) {
        return safeParseFloat(stringValue.slice(0, -1))
      } else if (stringValue.endsWith('M')) {
        return Math.round(safeParseFloat(stringValue.slice(0, -1)) / 1024 * 100) / 100
      }
      return 0

    default:
      return 0
  }
}
