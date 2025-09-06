import { z } from 'zod'
import { trpc } from '../trpc.ts'
import { transformQueryProcedure, transformWebhookRequest, withServerContext, withWebhookContext } from './_utils.ts'

import * as PurchaseCredits from '../../../../api/server/billing/purchase_credits.ts'
import * as GetClient from 'api/server/billing/get_client.ts'
import * as GetUsage from 'api/server/billing/get_usage.ts'
import * as SetLimits from 'api/server/billing/set_limits.ts'
import * as GetInvoices from 'api/server/billing/get_invoices.ts'
import * as Webhook from 'api/server/billing/webhook.ts'

export const purchaseCredits = trpc.procedure
  .use(withServerContext)
  .meta(PurchaseCredits.Meta)
  .input(PurchaseCredits.Input)
  .mutation(transformQueryProcedure(PurchaseCredits.default))

export const getClient = trpc.procedure
  .use(withServerContext)
  .meta(GetClient.Meta)
  .input(GetClient.Input)
  .query(transformQueryProcedure(GetClient.default))

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
  .meta(GetInvoices.Meta)
  .input(GetInvoices.Input)
  .query(transformQueryProcedure(GetInvoices.default))

export const webhook = trpc.procedure
  .use(withWebhookContext)
  .meta(Webhook.Meta)
  .input(Webhook.Input)
  .output(z.any())
  .query(transformWebhookRequest(Webhook.default))
