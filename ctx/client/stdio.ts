import { StdioContext } from '../mod.ts'

// This is dependent of the driver
export function createClientStdioContext(config: StdioContext['stdio']): StdioContext {
  return {
    stdio: config,
  }
}
