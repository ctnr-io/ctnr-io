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
    connectionParams: async () => {
      return {
        accessToken,
        refreshToken,
      }
    },
    WebSocket: globalThis.WebSocket,
    onOpen() {
      // Handle WebSocket open event
      console.debug("WebSocket connection established.");
      resolve()
    },
    onError(err) {
      // Handle WebSocket error event
      console.debug("WebSocket error:", err);
     reject(new Error("Failed to connect to WebSocket server. Please check your connection or the server status."));
    },
    onClose(cause) {
      console.debug(`WebSocket connection closed with code ${cause?.code || "unknown"}`);
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
