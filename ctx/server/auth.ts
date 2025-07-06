import { getSupabaseConfig } from "lib/supabase.ts";
import { createClient } from "@supabase/supabase-js";
import { AuthServerContext } from "../mod.ts";

export async function createAuthServerContext(
  opts: { accessToken: string; refreshToken: string },
): Promise<AuthServerContext> {
  const config = getSupabaseConfig();
  const supabase = createClient(config.url, config.anonKey);
  const { data: { session, user } } = await supabase.auth.setSession({
    access_token: opts.accessToken,
    refresh_token: opts.refreshToken,
  });
  if (!session) {
    throw new Error("Failed to set session with provided tokens");
  }
  if (!user) {
    throw new Error("Failed to retrieve user from session");
  }
  return {
    auth: {
      client: supabase.auth,
      session: session,
      user: user,
    },
  };
}
