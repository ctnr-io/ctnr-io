/**
 * Compose Transformer
 * Converts a parsed docker-compose.yaml document into a Stack DTO
 */
import { parse } from '@std/yaml'
import { Stack } from 'core/schemas/compute/stack.ts'

const RESTART_MAP: Record<string, 'always' | 'on-failure' | 'never'> = {
  'always': 'always',
  'on-failure': 'on-failure',
  'unless-stopped': 'always',
  'no': 'never',
}

/**
 * Sanitize an arbitrary string into a valid ctnr resource name
 */
export function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Map a compose port entry ("8080:80/tcp", "80", 80) to ctnr's publish format.
 * ctnr has no host-port mapping, so the host side (if any) is dropped.
 */
export function parsePort(value: string | number): string {
  const [portsPart, protocol = 'tcp'] = String(value).split('/')
  const parts = portsPart.split(':')
  const containerPort = parts.length > 1 ? parts[1] : parts[0]
  return `${containerPort}/${protocol}`
}

/**
 * Normalize compose's map or array environment form into KEY=value strings
 */
export function parseEnvironment(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry))
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, val]) => `${key}=${val ?? ''}`)
  }
  throw new Error('Invalid environment format: expected a map or a list of KEY=value strings')
}

/**
 * Normalize compose volume entries (short string or long object syntax) into
 * ctnr's "name:/path[:size]" volume mount strings
 */
export function parseVolumes(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value)) {
    throw new Error('Invalid volumes format: expected a list')
  }
  return value.map((entry) => {
    if (typeof entry === 'string') return entry
    if (typeof entry === 'object' && entry !== null) {
      const record = entry as Record<string, unknown>
      return `${String(record.source ?? '')}:${String(record.target ?? '')}`
    }
    throw new Error('Invalid volume entry')
  })
}

/**
 * Normalize compose's array or map depends_on form into a list of service names
 */
export function parseDependsOn(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>)
  throw new Error('Invalid depends_on format')
}

/**
 * Normalize compose's array or map networks form into a list of network names
 */
export function parseNetworks(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>)
  throw new Error('Invalid networks format')
}

/**
 * Map a compose restart policy to ctnr's restart enum
 */
export function parseRestart(value: unknown): 'always' | 'on-failure' | 'never' | undefined {
  if (value == null) return undefined
  const key = String(value)
  const mapped = RESTART_MAP[key]
  if (!mapped) {
    throw new Error(`Unsupported restart policy: ${key}`)
  }
  return mapped
}

/**
 * Convert a parsed docker-compose document into a Stack DTO.
 * Services without an "image" (build-only services) are not supported.
 */
export function composeToStack(doc: unknown, defaultName: string): Stack {
  if (typeof doc !== 'object' || doc === null) {
    throw new Error('Invalid compose file: expected a mapping at the document root')
  }
  const root = doc as Record<string, unknown>
  const servicesRaw = root.services
  if (typeof servicesRaw !== 'object' || servicesRaw === null) {
    throw new Error('Invalid compose file: missing "services"')
  }

  const services: Record<string, Record<string, unknown>> = {}
  for (const [serviceName, rawService] of Object.entries(servicesRaw as Record<string, unknown>)) {
    const service = rawService as Record<string, unknown>
    if (typeof service.image !== 'string' || service.image.length === 0) {
      throw new Error(`Service "${serviceName}" is missing an "image" (build-only services are not supported)`)
    }

    const ports = Array.isArray(service.ports) ? service.ports as Array<string | number> : []
    const env = parseEnvironment(service.environment)
    const volume = parseVolumes(service.volumes)
    const dependsOn = parseDependsOn(service.depends_on)
    const networks = parseNetworks(service.networks)
    const restart = parseRestart(service.restart)

    services[serviceName] = {
      image: service.image,
      ...(env.length > 0 ? { env } : {}),
      ...(ports.length > 0 ? { publish: ports.map(parsePort) } : {}),
      ...(volume.length > 0 ? { volume } : {}),
      ...(dependsOn.length > 0 ? { depends_on: dependsOn } : {}),
      ...(networks.length > 0 ? { networks } : {}),
      ...(restart ? { restart } : {}),
    }
  }

  return Stack.parse({
    name: sanitizeName(typeof root.name === 'string' ? root.name : defaultName),
    services,
  })
}

/**
 * Parse a raw docker-compose.yaml file's content into a Stack DTO
 */
export function parseComposeFile(content: string, defaultName: string): Stack {
  return composeToStack(parse(content), defaultName)
}
