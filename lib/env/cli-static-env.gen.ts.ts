/**
 * @file env.ts.ts
 * @description Environment variables for the application.
 * This file permit to have static environment variables when compiled with `deno compile`.
 */
import { ts } from '@tmpl/core'

const {
  CTNR_VERSION = '',
  CTNR_API_URL = 'http://localhost:3000',
  ZITADEL_ISSUER = '',
  ZITADEL_CLIENT_ID = '',
  ZITADEL_IDP_ID = '',
} = Deno.env.toObject()

export default ts`
Deno.env.set("CTNR_VERSION", "${CTNR_VERSION}")
Deno.env.set("CTNR_API_URL", "${CTNR_API_URL}")
Deno.env.set("ZITADEL_ISSUER", "${ZITADEL_ISSUER}")
Deno.env.set("ZITADEL_CLIENT_ID", "${ZITADEL_CLIENT_ID}")
Deno.env.set("ZITADEL_IDP_ID", "${ZITADEL_IDP_ID}")
`
