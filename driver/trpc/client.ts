import { createTRPCClient, createWSClient, wsLink } from "@trpc/client";
import { Router } from "./server.ts";

console.debug({
  CTNR_TRPC_API: Deno.env.get("CTNR_TRPC_API")
})

export const wsClient = createWSClient({
  url: Deno.env.get("CTNR_TRPC_API") || "ws://localhost:3000",
  connectionParams: () => {
    return {
      // token: 'your-supabase-access-token', // Replace with your actual token
    };
  },
  onOpen() {
    // Handle WebSocket open event
    console.log("WebSocket connection established.");
  },
  onError(err) {
    // Handle WebSocket error event
    console.debug("WebSocket error:", err);
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
      console.error(`WebSocket connection closed with code ${cause?.code || "unknown"}`);
    }
  },
});

while (wsClient.connection?.state !== 'open') {
  await new Promise(resolve => setTimeout(resolve, 100));
}

export const client = createTRPCClient<Router>({
  links: [wsLink({
    client: wsClient,
  })],
});
