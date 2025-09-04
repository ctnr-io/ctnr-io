import { createMollieClient } from '@mollie/api-client'

export function getMollieClient(): ReturnType<typeof createMollieClient> {
  return createMollieClient({
    apiKey: Deno.env.get('MOLLIE_API_KEY')!,
    apiEndpoint: Deno.env.get('MOLLIE_API_URL')!,
  })
}
