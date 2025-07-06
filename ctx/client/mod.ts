import { createSignalClientContext } from "./signal.ts";
import { createAuthClientContext } from "./auth.ts";
import { ClientContext, StdioContext } from "../mod.ts";
import { createStdioClientContext } from "./stdio.ts";

export async function createClientContext(opts: {
	stdio: StdioContext["stdio"]
}): Promise<ClientContext> {
	const signalContext = await createSignalClientContext();
	const authContext = await createAuthClientContext();
	const stdioContext = await createStdioClientContext(opts.stdio);
  return {
		__type: "client",
		...signalContext,
		...authContext,
		...stdioContext,
  }
}