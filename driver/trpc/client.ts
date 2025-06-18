import { createTRPCClient, createWSClient, wsLink } from "@trpc/client";
import { Router } from "./server.ts";

export const wsClient = createWSClient({
  url: Deno.env.get("CTNR_TRPC_WS_URL") || "ws://localhost:3000",
  connectionParams: () => {
    return {
      // token: 'your-supabase-access-token', // Replace with your actual token
    };
  },
});

export const client = createTRPCClient<Router>({
  links: [wsLink({
    client: wsClient,
  })],
});
