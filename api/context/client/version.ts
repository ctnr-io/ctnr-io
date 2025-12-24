import { VersionContext } from 'api/context/mod.ts'
import process from 'node:process'

// This is dependent of the driver
export async function createClientVersionContext(): Promise<VersionContext> {
  return {
    version: process.env.CTNR_VERSION || 'unknown',
  }
}
