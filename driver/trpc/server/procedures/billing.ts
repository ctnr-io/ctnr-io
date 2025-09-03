import { z } from 'zod'
import { trpc } from '../trpc.ts'
import { transformQueryProcedure, transformWebhookRequest, withServerContext, withWebhookContext } from './_utils.ts'

import * as BuyCredits from 'api/server/billing/buy_credits.ts'
import * as GetUsage from 'api/server/billing/get_usage.ts'
import * as SetLimits from 'api/server/billing/set_limits.ts'
import * as GetInvoice from 'api/server/billing/get_invoice.ts'
import * as GetPayments from 'api/server/billing/get_payments.ts'
import * as Webhook from 'api/server/billing/webhook.ts'

export const buyCredits = trpc.procedure
  .use(withServerContext)
  .meta(BuyCredits.Meta)
  .input(BuyCredits.Input)
  .mutation(transformQueryProcedure(BuyCredits.default))

export const getUsage = trpc.procedure
  .use(withServerContext)
  .meta(GetUsage.Meta)
  .input(GetUsage.Input)
  .query(transformQueryProcedure(GetUsage.default))

export const setLimits = trpc.procedure
  .use(withServerContext)
  .input(SetLimits.Input)
  .mutation(transformQueryProcedure(SetLimits.default))

export const getInvoices = trpc.procedure
  .use(withServerContext)
  .meta(GetInvoice.Meta)
  .input(GetInvoice.Input)
  .query(transformQueryProcedure(GetInvoice.default))

export const getPayments = trpc.procedure
  .use(withServerContext)
  .meta(GetPayments.Meta)
  .input(GetPayments.Input)
  .query(transformQueryProcedure(GetPayments.default))

export const webhook = trpc.procedure
  .use(withWebhookContext)
  .meta(Webhook.Meta)
  .input(Webhook.Input)
  .output(z.any())
  .query(transformWebhookRequest(Webhook.default))
