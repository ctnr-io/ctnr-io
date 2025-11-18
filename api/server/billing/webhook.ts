import { WebhookRequest, WebhookResponse } from 'lib/api/types.ts'
import z from 'zod'
import { PaymentMetadataV1 } from 'lib/billing/utils.ts'
import { formatDate } from 'date-fns'
import { addCredits } from 'lib/billing/balance.ts'
import ensureProject from '../project/_ensure.ts'
import { createServerProjectContext } from 'ctx/server/project.ts'

export const Meta = {
  openapi: { method: 'POST', path: '/billing/webhook' },
} as const

export const Input = z.object({
  id: z.string(),
})

export type Input = z.infer<typeof Input>

export type Output = Response

export default async function* ({ ctx, input }: WebhookRequest<Input>): WebhookResponse<Output> {
  console.debug('Billing webhook triggered:', { input })

  // Get payment ID from the request body
  const paymentId = input.id

  if (!paymentId) {
    console.error('No payment ID provided in webhook')
    return new Response('Bad Request', { status: 400 })
  }

  // Fetch payment details from Mollie
  const payment = await ctx.billing.client['mollie'].payments.get(paymentId)

  if (!payment) {
    console.error(`Payment not found: ${paymentId}`)
    return new Response('Payment not found', { status: 404 })
  }

  // Process payment based on status
  if (payment.status === 'paid') {
    const metadata = PaymentMetadataV1.safeParse(payment.metadata)
    if (!metadata.success) {
      throw new Error(`Invalid payment metadata for payment ${paymentId}: ${metadata.error}`)
    }
    const userId = metadata?.data.userId
    if (!userId) {
      console.error(`Invalid metadata for payment ${paymentId}: missing userId`, payment.metadata)
      return new Response('Invalid payment metadata', { status: 400 })
    }

    const controller = new AbortController()

    const project = yield* ensureProject({
    })

    const ServerProjectContext = createServerProjectContext({ userId, id: project.id }).project


    const namespaceObj = await ctx.kube.client['karmada'].CoreV1.getNamespace(ServerProjectContext.namespace)

    // Get qonto client id
    const qontoClientId = namespaceObj.metadata?.labels?.['ctnr.io/qonto-client-id']
    if (!qontoClientId) {
      console.error(`No Qonto client ID found for namespace ${ServerProjectContext.namespace}`)
      return new Response('Internal Server Error', { status: 500 })
    }

    // Create an invoice
    console.info('Creating invoice in Qonto for client', qontoClientId)

    const issueDate = formatDate(new Date(payment.paidAt!), 'yyyy-MM-dd')
    const amountWithVAT = Number(payment.amount.value)
    const amountWithoutVAT = amountWithVAT / 1.2
    const invoice = await ctx.billing.client.qonto.createClientInvoice({
      client_id: qontoClientId,
      issue_date: issueDate,
      due_date: issueDate,
      currency: payment.amount.currency,
      payment_methods: {
        iban: Deno.env.get('QONTO_IBAN'),
      },
      items: [{
        title: `${metadata.data.credits} credits`,
        quantity: '1',
        unit_price: {
          currency: payment.amount.currency,
          value: amountWithoutVAT.toFixed(2),
        },
        vat_rate: '0.2',
      }],
      // We cannot set it as paid now
      status: 'unpaid',
    })

    const invoiceUrl = invoice.client_invoice?.invoice_url!

    // Update payment metadata with invoice
    await ctx.billing.client.mollie.payments.update(paymentId, {
      metadata: {
        ...metadata.data,
        invoiceUrl,
      } satisfies PaymentMetadataV1,
    })

    // Handle successful payment
    console.info(`Payment ${paymentId} succeeded:`, payment)

    const newBalance = await addCredits(ctx.kube.client['karmada'], ServerProjectContext.namespace, metadata.data.credits, controller.signal)

    console.info(`New balance for user ${userId}:`, newBalance)

    return new Response('Payment processed successfully')
  }
  return new Response('Payment not processed', { status: 400 })
}
