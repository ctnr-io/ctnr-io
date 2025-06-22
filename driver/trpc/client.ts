import { createTRPCClient, createWSClient, wsLink } from "@trpc/client";
import { Router } from "./server.ts";

export const wsClient = createWSClient({
  url: Deno.env.get("CTNR_TRPC_WS_URL") || "ws://localhost:3000",
  connectionParams: () => {
    return {
      // token: 'your-supabase-access-token', // Replace with your actual token
    };
  },
  onClose(cause) {
    // Handle WebSocket close event gracefully
    if (cause?.code === 1005) {
      // This is a clean close, likely from Ctrl+D (EOF)
      // We can exit the process gracefully
      console.log("WebSocket connection closed cleanly.");
      // Optional: You can exit the process here if needed
      // Deno.exit(0);
    } else {
      // This is an unexpected close
      console.error(`WebSocket connection closed with code ${cause?.code || "unknown"}`);
    }
  },
});

export const client = createTRPCClient<Router>({
  links: [wsLink({
    client: wsClient,
  })],
});
