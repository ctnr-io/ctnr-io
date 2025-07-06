import { getSupabaseClient } from "lib/supabase.ts";
import type { AuthClientContext } from "../mod.ts";
import { authStorage } from "driver/trpc/client/terminal/storage.ts";

export async function createAuthClientContext(): Promise<AuthClientContext> {
  const supabase = getSupabaseClient({
    storage: authStorage,
  });
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser();
  if (!session || !user) {
    return {
      auth: {
        client: supabase.auth,
        session: null,
        user: null,
      },
    }
  }
  return {
    auth: {
      client: supabase.auth,
      session,
      user,
    },
  };
}
