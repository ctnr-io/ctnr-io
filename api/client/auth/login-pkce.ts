import { openBrowser, startCallbackServer } from "driver/trpc/client/terminal/auth-callback-server.ts";
import { AuthClientContext } from "ctx/mod.ts";
import { ClientResponse } from "../../server/core/_common.ts";

export default async function* ({ ctx }: { ctx: AuthClientContext }): ClientResponse {
  try {
    // Check if user is already authenticated
    const { data: { session } } = await ctx.auth.client.getSession();
    if (session?.access_token && (session?.expires_at ?? 0) < Date.now()) {
      yield `🔑 Authenticated as ${session.user.email}.`;
      return;
    }
    yield "🔑 Starting OAuth flow...";

    // Generate PKCE parameters
    const { server, promise, url } = startCallbackServer();

    const oauth = await ctx.auth.client.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: url,
        scopes: "user:email",
      },
    });

    if (!oauth.data.url) {
      console.error("OAuth URL is missing from response");
      throw new Error("OAuth URL is missing from response");
    }

    if (Deno.stdin.isTerminal()) {
      yield `📱 Opening browser for authentication...`;

      // Open browser
      try {
        await openBrowser(oauth.data.url);
      } catch (error) {
        console.warn("Failed to open browser automatically:", error);
        yield `Please manually open: ${oauth.data.url}`;
      }
    } else {
      yield "📱 Running in non-interactive mode, please open the following URL in your browser:";
      yield `  ${oauth.data.url}`;
      yield "After authenticating, return to this terminal to continue.";
    }

    // Wait for callback
    yield "⏳ Waiting for authentication callback...";
    const { code } = await promise;

    // Exchange code for tokens  exchangeCodeForTokens,
    const { data } = await ctx.auth.client.exchangeCodeForSession(code);

    const { access_token, refresh_token } = data.session || {};
    if (!access_token) {
      throw new Error("No access token received from OAuth flow");
    }
    if (!refresh_token) {
      console.warn("No refresh token received, you may need to re-authenticate periodically");
    }

    // Store tokens
    // Set session in Supabase client
    await ctx.auth.client.setSession({
      access_token,
      refresh_token: refresh_token || "",
    });

    // Shutdown server
    server.shutdown();

    yield "✅ Authentication successful!";
  } catch (error) {
    throw new Error(`OAuth flow failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
