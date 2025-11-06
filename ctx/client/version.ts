import { VersionContext } from 'ctx/mod.ts'
import process from 'node:process'
import * as GetServerVersion from 'api/server/version/get_version.ts'

/**
 * Error thrown when the client version is out of date and needs to be upgraded.
 * Can be catch by the client's driver to auto upgrade
 */
export class ClientVersionError extends Error {
  override message: string = 'Client version is out of date. Please upgrade the client.'
}

// This is dependent of the driver
export async function createClientVersionContext(): Promise<VersionContext> {
  // Call server to know its current version
  const url = new URL(GetServerVersion.Meta.openapi.path, process.env.CTNR_API_URL!)
  const response = await fetch(url, {
    method: GetServerVersion.Meta.openapi.method,
  })
  if (!response.ok) {
    throw new Error('Failed to fetch server version')
  }
  const serverVersion: GetServerVersion.Output = await response.json()
  const clientVersion = process.env.CTNR_VERSION || process.env.EXPO_PUBLIC_CTNR_VERION || 'unknown'

  // If cli version != remote version, re-install cli
  if (serverVersion !== clientVersion) {
    throw new ClientVersionError()
  }

  return {
    version: process.env.CTNR_VERSION || process.env.EXPO_PUBLIC_CTNR_VERION || 'unknown',
  }
}
