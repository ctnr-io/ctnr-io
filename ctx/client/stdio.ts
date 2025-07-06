import { StdioContext } from "../mod.ts";

// This is dependent of the driver
export async function createStdioClientContext(config: StdioContext['stdio']): Promise<StdioContext> {
	return {
		stdio: config,
	}
}
