import { StdioContext } from '../mod.ts'

// This is dependent of the driver
export function createServerStdioContext(config: StdioContext['stdio']): StdioContext {
  return {
    stdio: config,
  }
}
