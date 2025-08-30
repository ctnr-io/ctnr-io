import { z } from 'zod'
import { trpc } from '../trpc.ts'
import { transformSubscribeProcedure, transformWebhookRequest, withServerContext, withWebhookContext } from './_utils.ts'

import * as BuyCredits from 'api/server/billing/buy-credits.ts'
import * as Webhook from 'api/server/billing/webhook.ts'

export const buyCredits = trpc.procedure
  .use(withServerContext)
  .meta(BuyCredits.Meta)
  .input(BuyCredits.Input)
  .subscription(transformSubscribeProcedure(BuyCredits.default))

export const webhook = trpc.procedure
  .use(withWebhookContext)
  .meta({ openapi: { method: 'POST', path: '/billing/webhook' } })
  .meta(Webhook.Meta)
  .input(Webhook.Input)
  .output(z.any())
  .query(transformWebhookRequest(Webhook.default))
