import { createClient, SupabaseClient, SupportedStorage } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey?: string
}

let supabaseClient: SupabaseClient | null = null
let supabaseServiceClient: SupabaseClient | null = null

export function getSupabaseConfig(): SupabaseConfig {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required')
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  }
}

export function getSupabaseClient({ storage }: {
  storage?: SupportedStorage
}): SupabaseClient {
  if (!supabaseClient) {
    const config = getSupabaseConfig()
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        storage,
      },
    })
  }
  return supabaseClient
}

export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseServiceClient) {
    const config = getSupabaseConfig()
    if (!config.serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for service client')
    }
    supabaseServiceClient = createClient(config.url, config.serviceRoleKey)
  }
  return supabaseServiceClient
}

// export async function verifySupabaseToken(token: string): Promise<User | null> {
//   try {
//     const supabase = getSupabaseClient();
//     const { data: { user }, error } = await supabase.auth.getUser(token);

//     if (error) {
//       console.error("Supabase token verification error:", error);
//       return null;
//     }

//     return user;
//   } catch (error) {
//     console.error("Error verifying Supabase token:", error);
//     return null;
//   }
// }

// export async function getSupabaseUser(accessToken: string): Promise<User | null> {
//   try {
//     const supabase = getSupabaseClient();
//     supabase.auth.setSession({
//       access_token: accessToken,
//       refresh_token: "", // We don't need refresh token for verification
//     });

//     const { data: { user }, error } = await supabase.auth.getUser();

//     if (error) {
//       console.error("Error getting Supabase user:", error);
//       return null;
//     }

//     return user;
//   } catch (error) {
//     console.error("Error getting Supabase user:", error);
//     return null;
//   }
// }
