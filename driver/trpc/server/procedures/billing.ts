import { z } from 'zod'
import { trpc } from '../trpc.ts'
import { transformQueryProcedure, transformSubscribeProcedure, transformWebhookRequest, withServerContext, withWebhookContext } from './_utils.ts'

import * as BuyCredits from 'api/server/billing/buy-credits.ts'
import * as GetUsage from 'api/server/billing/get-usage.ts'
import * as DeductCredits from 'api/server/billing/deduct-credits.ts'
import * as GetInvoices from 'api/server/billing/get-invoices.ts'
import * as GetPayments from 'api/server/billing/get-payments.ts'
import * as SubscribeTier from 'api/server/billing/subscribe-tier.ts'
import * as Webhook from 'api/server/billing/webhook.ts'

export const buyCredits = trpc.procedure
  .use(withServerContext)
  .meta(BuyCredits.Meta)
  .input(BuyCredits.Input)
  .subscription(transformSubscribeProcedure(BuyCredits.default))

export const getUsage = trpc.procedure
  .use(withServerContext)
  .meta(GetUsage.Meta)
  .input(GetUsage.Input)
  .query(transformQueryProcedure(GetUsage.default))

export const deductCredits = trpc.procedure
  .use(withServerContext)
  .meta(DeductCredits.Meta)
  .input(DeductCredits.Input)
  .mutation(transformQueryProcedure(DeductCredits.default))

export const getInvoices = trpc.procedure
  .use(withServerContext)
  .meta(GetInvoices.Meta)
  .input(GetInvoices.Input)
  .query(transformQueryProcedure(GetInvoices.default))

export const getPayments = trpc.procedure
  .use(withServerContext)
  .meta(GetPayments.Meta)
  .input(GetPayments.Input)
  .query(transformQueryProcedure(GetPayments.default))

export const subscribeTier = trpc.procedure
  .use(withServerContext)
  .meta(SubscribeTier.Meta)
  .input(SubscribeTier.Input)
  .mutation(transformQueryProcedure(SubscribeTier.default))

export const webhook = trpc.procedure
  .use(withWebhookContext)
  .meta({ openapi: { method: 'POST', path: '/billing/webhook' } })
  .meta(Webhook.Meta)
  .input(Webhook.Input)
  .output(z.any())
  .query(transformWebhookRequest(Webhook.default))
