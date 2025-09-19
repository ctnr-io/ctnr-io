import { VersionContext } from './mod.ts'
import process from 'node:process'

// This is dependent of the driver
export async function createVersionContext(): Promise<VersionContext> {
	return {
		version: process.env.CTNR_VERSION || 'unknown'
	}
}
