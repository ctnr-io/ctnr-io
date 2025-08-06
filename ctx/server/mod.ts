import { createSignalServerContext } from "./signal.ts";
import { createAuthServerContext } from "./auth.ts";
import { ServerContext, StdioContext } from "../mod.ts";
import { createKubeServerContext } from "./kube.ts";
import { createStdioServerContext } from "./stdio.ts";
import { createDeferServerContext } from "./defer.ts";

export async function createServerContext(opts: {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  stdio: StdioContext["stdio"];
}): Promise<ServerContext> {
  const signalContext = await createSignalServerContext();
  const authContext = await createAuthServerContext(opts);
  const kubeContext = await createKubeServerContext(authContext.auth.user.id);
  const stdioContext = await createStdioServerContext(opts.stdio);
  const deferContext = await createDeferServerContext();
  return {
    __type: "server",
    ...signalContext,
    ...authContext,
    ...kubeContext,
    ...stdioContext,
    ...deferContext,
  };
};