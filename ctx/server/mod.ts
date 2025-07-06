import { createSignalServerContext } from "./signal.ts";
import { createAuthServerContext } from "./auth.ts";
import { ServerContext, StdioContext } from "../mod.ts";
import { createKubeServerContext } from "./kube.ts";
import { createStdioServerContext } from "./stdio.ts";

export async function createServerContext(opts: {
	accessToken: string;
	refreshToken: string;
	stdio: StdioContext["stdio"]
}): Promise<ServerContext> {
	const signalContext = await createSignalServerContext();
	const authContext = await createAuthServerContext(opts);
	const { data: { user } } = await authContext.auth.client.getUser();
	if (!user) {
		throw new Error("Failed to create server context: user is not authenticated");
	}
	const kubeContext = await createKubeServerContext(user.id);
	const stdioContext = await createStdioServerContext(opts.stdio);
  return {
		__type: "server",
		...signalContext,
		...authContext,
		...kubeContext,
		...stdioContext,
  }
}``