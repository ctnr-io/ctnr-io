import { KubeClient } from 'infra/kubernetes/mod.ts'
import { QontoClient, CreateClientRequest } from 'infra/qonto/mod.ts'
import { match } from 'ts-pattern'
import type { Invoice } from 'core/schemas/billing/invoice.ts'
import type { MollieClient } from '@mollie/api-client'

export interface InvoiceContext {
	mollieClient: MollieClient
	mollieCustomerId: string
}

export interface ListInvoicesOptions {
	cursor?: string
	limit?: number
}

/**
 * List invoices (payments) from Mollie
 */
export async function listInvoices(
	ctx: InvoiceContext,
	options: ListInvoicesOptions = {},
): Promise<Invoice[]> {
	const { mollieClient, mollieCustomerId } = ctx
	const { limit = 20 } = options

	const payments = await mollieClient.customerPayments.page({
		customerId: mollieCustomerId,
		limit,
	})

	return payments.map((payment): Invoice => ({
		id: payment.id,
		amount: {
			value: payment.amount.value,
			currency: payment.amount.currency,
		},
		description: payment.description ?? '',
		status: payment.status === 'paid' ? 'paid' : payment.status === 'failed' ? 'failed' : 'pending',
		createdAt: payment.createdAt ?? '',
		paidAt: payment.paidAt ?? undefined,
		expiredAt: payment.expiredAt ?? undefined,
		credits: Math.round(Number(payment.amount.value) * 100), // Convert EUR to credits (1 EUR = 100 credits)
	}))
}

export async function ensureInvoice(opts: {
  kubeClient: KubeClient
  namespace: string
  qontoClient: QontoClient
  abortSignal: AbortSignal
  invoiceClient: CreateClientRequest
}): Promise<string> {
  const { kubeClient: kc, namespace, qontoClient, abortSignal, invoiceClient } = opts

  // Get the current namespace to check for existing client IDs
  const ns = await kc.CoreV1.getNamespace(namespace, { abortSignal })

  // Determine the label key based on client type
  const labelKey = `ctnr.io/qonto-client-id`

  // Check if client ID already exists in namespace labels
  const existingClientId = ns?.metadata?.labels?.[labelKey]

  // Get the existing client from Qonto (or null if it doesn't exist)
  const existingClient = existingClientId
    ? await qontoClient.getClientSDetails({ id: existingClientId }).catch(() => null)
    : null

  return await match(existingClient)
    // If client doesn't exist, create it
    .with(null, async () => {
      const response = await qontoClient.createClient(invoiceClient)
      if (!response.client?.id) {
        throw new Error('Failed to create Qonto client')
      }

      // Update namespace with the new client ID
      await kc.CoreV1.patchNamespace(namespace, 'json-merge', {
        metadata: {
          labels: {
            [labelKey]: response.client.id,
          },
        },
      }, { abortSignal })

      return response.client.id
    })
    // If client exists and matches, do nothing
    .with(invoiceClient as any, () => existingClientId!)
    // Otherwise, delete and recreate the client
    .otherwise(async () => {
      console.debug('Replacing existing Qonto client', existingClientId)

      // Delete the existing client (if it exists in Qonto)
      if (existingClientId) {
        await qontoClient.deleteClient({ id: existingClientId }).catch((error) => {
          // Ignore errors if client doesn't exist in Qonto
          console.warn(`Failed to delete existing Qonto client ${existingClientId}:`, error)
        })
      }

      // Create a new client
      const response = await qontoClient.createClient(invoiceClient)
      if (!response.client?.id) {
        throw new Error('Failed to create Qonto client')
      }

      // Update namespace with the new client ID
      await kc.CoreV1.patchNamespace(namespace, 'json-merge', {
        metadata: {
          labels: {
            [labelKey]: response.client.id,
          },
        },
      }, { abortSignal })

      return response.client.id
    })
}
