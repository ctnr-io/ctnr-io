import { z } from 'zod'
import { trpc } from '../trpc.ts'
import { transformWebhookRequest, withWebhookContext } from './_utils.ts'

import * as GetVersion from 'api/server/version/get_version.ts'

export const getVersion = trpc.procedure
  .use(withWebhookContext)
  .meta(GetVersion.Meta)
  .input(GetVersion.Input)
  .output(z.any())
  .query(transformWebhookRequest(GetVersion.default))
