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
      console.info(`🔑 Authenticated as ${session.user.email}.`);
      return session;
    }
    console.info("🔑 Starting OAuth flow...");

    // Generate PKCE parameters
    const { server, promise, url, } = startCallbackServer();

    const oauth = await client.auth.signInWithOAuth({
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
      console.info(`📱 Opening browser for authentication...`);

      // Open browser
      try {
        await openBrowser(oauth.data.url);
      } catch (error) {
        console.warn("Failed to open browser automatically:", error);
        console.info(`Please manually open: ${oauth.data.url}`);
      }
    } else {
      console.info("📱 Running in non-interactive mode, please open the following URL in your browser:");
      console.info(`  ${oauth.data.url}`);
      console.info("After authenticating, return to this terminal to continue.");
    }

    // Wait for callback
    console.info("⏳ Waiting for authentication callback...");
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

    console.info("✅ Authentication successful!");

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

    console.info("🔓 Logged out successfully");
  } catch (error) {
    console.warn("Error during logout:", error);
  }
}
