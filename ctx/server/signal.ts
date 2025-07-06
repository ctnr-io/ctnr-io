import { SignalContext } from "../mod.ts";

export async function createSignalServerContext(): Promise<SignalContext> {
	const controller = new AbortController();
	return {
		signal: controller.signal 
	};
}