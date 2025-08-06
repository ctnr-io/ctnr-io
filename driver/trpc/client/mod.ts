import "lib/utils.ts";
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from "@trpc/client";
import { ServerRouter } from "driver/trpc/server/router.ts";

export async function createTRPCWebSocketClient({
  accessToken,
  refreshToken,
}: {
  accessToken?: string;
  refreshToken?: string;
}): Promise<{
  websocket: ReturnType<typeof createWSClient>;
  trpc: TRPCClient<ServerRouter>;
}> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const wsClient = createWSClient({
    url: Deno.env.get("CTNR_API_URL")!,
    connectionParams: () => {
      return {
        accessToken,
        refreshToken,
      };
    },
    WebSocket: globalThis.WebSocket,
    onOpen() {
      // Handle WebSocket open event
      console.debug("WebSocket connection established.");
      resolve();
    },
    onClose(cause = { code: 1000 }) {
      const { reason, code } = cause as { reason?: string, code: number };
      // Never retry connection on close
      if (code !== 1000) { // 1000 is normal closure
        console.error(reason || "Unexpected error")
        reject(new Error(reason))
        Deno.exit(code)
      } else {
        resolve();
        Deno.exit(0);
      }
    },
  });

  await promise;

  const trpcClient = createTRPCClient<ServerRouter>({
    links: [wsLink({
      client: wsClient,
    })],
  }) as TRPCClient<ServerRouter>;
  return {
    websocket: wsClient,
    trpc: trpcClient,
  };
}
