import { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "lib/supabase.ts";

import { openBrowser, startCallbackServer } from "./auth-callback-server.ts";
import { authStorage } from "./storage.ts";

/**
 * Perform complete PKCE OAuth flow
 */
export async function performOAuthFlow(): Promise<Session> {
  try {
    // Check if user is already authenticated
    const client = getSupabaseClient({ storage: authStorage });
    const { data: { session } } = await client.auth.getSession();
    if (session?.access_token && (session?.expires_at ?? 0) < Date.now()) {
      console.log("🔑 Already authenticated, skipping OAuth flow");
      return session;
    }

    // Generate PKCE parameters
    const { port, server, promise } = startCallbackServer();

    const oauth = await client.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `http://localhost:${port}/callback`,
        scopes: "user:email",
      },
    });

    if (!oauth.data.url) {
      console.error("OAuth URL is missing from response");
      throw new Error("OAuth URL is missing from response");
    }

    if (Deno.stdin.isTerminal()) {
      console.log(`📱 Opening browser for authentication...`);

      // Open browser
      try {
        await openBrowser(oauth.data.url);
      } catch (error) {
        console.warn("Failed to open browser automatically:", error);
        console.log(`Please manually open: ${oauth.data.url}`);
      }
    } else {
      console.log("📱 Running in non-interactive mode, please open the following URL in your browser:");
      console.log(`  ${oauth.data.url}`);
      console.log("After authenticating, return to this terminal to continue.");
    }

    // Wait for callback
    console.log("⏳ Waiting for authentication callback...");
    const { code } = await promise;

    // Exchange code for tokens  exchangeCodeForTokens,
    const { data } = await client.auth.exchangeCodeForSession(code);

    const { access_token, refresh_token } = data.session || {};
    if (!access_token) {
      throw new Error("No access token received from OAuth flow");
    }
    if (!refresh_token) {
      console.warn("No refresh token received, you may need to re-authenticate periodically");
    }

    // Store tokens
    // Set session in Supabase client
    await client.auth.setSession({
      access_token,
      refresh_token: refresh_token || "",
    });

    // Shutdown server
    server.shutdown();

    console.log("✅ Authentication successful!");

    return (await client.auth.getSession()).data.session!
  } catch (error) {
    throw new Error(`OAuth flow failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let performOAuthFlowPromise: Promise<Session>| null= null; 
export function performOAuthFlowOnce(): Promise<Session> {
  if (!performOAuthFlowPromise) {
    performOAuthFlowPromise = performOAuthFlow();
  }
  return performOAuthFlowPromise;
}

/**
 * Clear stored authentication tokens (logout)
 */
export async function logout(): Promise<void> {
  try {
    // Clear Supabase session
    const supabase = getSupabaseClient({ storage: authStorage });
    await supabase.auth.signOut();

    console.log("🔓 Logged out successfully");
  } catch (error) {
    console.warn("Error during logout:", error);
  }
}
