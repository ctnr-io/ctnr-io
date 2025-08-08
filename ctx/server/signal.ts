import { SignalContext } from '../mod.ts'

export function createSignalServerContext(): SignalContext {
  const controller = new AbortController()
  return {
    signal: controller.signal,
  }
}
