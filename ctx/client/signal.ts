import { SignalContext } from "../mod.ts";

export async function createSignalClientContext(): Promise<SignalContext> {
	const controller = new AbortController();
	return {
		signal: controller.signal 
	};
}