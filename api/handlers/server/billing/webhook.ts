import { WebhookRequest, WebhookResponse } from 'lib/api/types.ts'
import z from 'zod'
import { PaymentMetadataV1 } from 'core/rules/billing/utils.ts'
import { formatDate } from 'date-fns'
import { getProject, getNamespaceName } from 'core/data/tenancy/project.ts'
import { addCredits } from 'core/rules/billing/balance.ts'

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
    const ownerId = metadata?.data.ownerId
    if (!ownerId) {
      console.error(`Invalid metadata for payment ${paymentId}: missing ownerId`, payment.metadata)
      return new Response('Invalid payment metadata', { status: 400 })
    }

    const projectId = metadata?.data.projectId
    if (!projectId) {
      console.error(`Invalid metadata for payment ${paymentId}: missing projectId`, payment.metadata)
      return new Response('Invalid payment metadata', { status: 400 })
    }

    const controller = new AbortController()

    const project = await getProject(
      ctx.kube.client['karmada'],
      { userId: ownerId, projectId },
      controller.signal
    )
    if (!project) {
      console.error(`Project not found for payment ${paymentId}:`, {
        projectId,
        ownerId,
      })
      return new Response('Project not found', { status: 404 })
    }

    if (project.ownerId !== ownerId) {
      console.error(`Owner ID mismatch for payment ${paymentId}:`, {
        expected: project.ownerId,
        actual: ownerId,
      })
      return new Response('Owner ID mismatch', { status: 400 })
    }

    // Get user namespace for Qonto client (owner-scoped)
    const userNamespace = `ctnr-user-${ownerId}`
    const userNamespaceObj = await ctx.kube.client['karmada'].CoreV1.getNamespace(userNamespace)

    // Get qonto client id from user namespace
    const qontoClientId = userNamespaceObj.metadata?.labels?.['ctnr.io/qonto-client-id']
    if (!qontoClientId) {
      console.error(`No Qonto client ID found for user namespace ${userNamespace}`)
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

    const projectNamespace = getNamespaceName(projectId, ownerId)
    const newBalance = await addCredits(
      ctx.kube.client['karmada'],
      projectNamespace,
      metadata.data.credits,
      controller.signal,
    )

    console.info(`New balance for project ${projectId}:`, newBalance)
    return new Response('Payment processed successfully')
  }
  return new Response('Payment not processed because not paid', { status: 400 })
}
