import { VersionContext } from './mod.ts'
import process from 'node:process'

// This is dependent of the driver
export function createVersionContext(): VersionContext {
  return {
    version: process.env.CTNR_VERSION || 'unknown',
  }
}
