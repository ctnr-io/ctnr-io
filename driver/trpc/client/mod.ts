import "lib/utils.ts";
import { createTRPCClient, createWSClient, TRPCClient, wsLink } from "@trpc/client";
import { ServerRouter } from "driver/trpc/server/router.ts";

export async function createTRPCWebSocketClient(): Promise<{
  websocket: ReturnType<typeof createWSClient>,
  trpc: TRPCClient<ServerRouter>
}> {
  const wsClient = createWSClient({
    url: Deno.env.get("CTNR_API_URL") || "https://api.ctnr.io",
    WebSocket: globalThis.WebSocket,
    connectionParams: async () => {
      return {}
    },
    onOpen() {
      // Handle WebSocket open event
      console.debug("WebSocket connection established.");
    },
    onError(err) {
      // Handle WebSocket error event
      console.debug("WebSocket error:", err);
      Deno.exit(1); // Exit the process on error
    },
    onClose(cause) {
      // Handle WebSocket close event gracefully
      if (cause?.code === 1005) {
        // This is a clean close, likely from Ctrl+D (EOF)
        // We can exit the process gracefully
        console.debug("WebSocket connection closed cleanly.");
        // Optional: You can exit the process here if needed
        // Deno.exit(0);
      } else {
        // This is an unexpected close
        console.debug(`WebSocket connection closed with code ${cause?.code || "unknown"}`);
      }
    },
  });

  while (wsClient.connection?.state !== "open") {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

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
