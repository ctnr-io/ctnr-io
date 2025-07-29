import { SignalContext } from "../mod.ts";

export function createSignalClientContext(): SignalContext {
  const controller = new AbortController();
  return {
    signal: controller.signal,
  };
}
