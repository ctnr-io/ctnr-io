import type { KubeClient } from 'infra/kubernetes/mod.ts'
import type { QontoClient, CreateClientRequest, CreateClientResponse } from 'infra/qonto/mod.ts'
import type { BillingClient } from 'core/schemas/billing/client.ts'

export interface BillingClientContext {
	kubeClient: KubeClient
	qontoClient: QontoClient
	qontoClientId: string
	userId: string
}

/**
 * Transform Qonto client response to BillingClient DTO
 */
function qontoToBillingClient(qontoClient: CreateClientResponse['client']): BillingClient | null {
	if (!qontoClient) return null

	const client = qontoClient
	const isCompany = client.type === 'company'

	if (isCompany) {
		return {
			type: 'company',
			name: client.name || '',
			taxIdentificationNumber: client.tax_identification_number || '',
			vatNumber: client.vat_number,
			currency: 'EUR',
			locale: 'fr',
			billingAddress: {
				streetAddress: client.billing_address?.street_address || client.address || '',
				city: client.billing_address?.city || client.city || '',
				postalCode: client.billing_address?.zip_code || client.zip_code || '',
				countryCode: client.billing_address?.country_code || client.country_code || '',
			},
		}
	}

	// For individual, parse name to firstName/lastName
	const nameParts = (client.name || '').split(' ')
	const firstName = nameParts[0] || ''
	const lastName = nameParts.slice(1).join(' ') || ''

	return {
		type: 'individual',
		firstName,
		lastName,
		currency: 'EUR',
		locale: 'fr',
		billingAddress: {
			streetAddress: client.billing_address?.street_address || client.address || '',
			city: client.billing_address?.city || client.city || '',
			postalCode: client.billing_address?.zip_code || client.zip_code || '',
			countryCode: client.billing_address?.country_code || client.country_code || '',
		},
	}
}

/**
 * Transform BillingClient DTO to Qonto CreateClientRequest
 */
function billingClientToQonto(client: BillingClient): CreateClientRequest {
	const base = {
		currency: client.currency,
		locale: client.locale,
		billing_address: {
			street_address: client.billingAddress.streetAddress,
			city: client.billingAddress.city,
			zip_code: client.billingAddress.postalCode,
			country_code: client.billingAddress.countryCode,
		},
	}

	if (client.type === 'company') {
		return {
			...base,
			type: 'company',
			name: client.name,
			tax_identification_number: client.taxIdentificationNumber,
			vat_number: client.vatNumber,
		}
	}

	return {
		...base,
		type: 'individual',
		first_name: client.firstName,
		last_name: client.lastName,
		name: `${client.firstName} ${client.lastName}`,
	}
}

/**
 * Get billing client from Qonto
 */
export async function getBillingClient(
	ctx: BillingClientContext,
): Promise<BillingClient | null> {
	const { qontoClient, qontoClientId } = ctx

	if (!qontoClientId) {
		return null
	}

	try {
		const response = await qontoClient.getClientSDetails({ id: qontoClientId })
		return qontoToBillingClient(response?.client)
	} catch {
		return null
	}
}

/**
 * Ensure billing client exists in Qonto (upsert)
 */
export async function ensureBillingClient(
	ctx: BillingClientContext,
	client: BillingClient,
	signal?: AbortSignal,
): Promise<string> {
	const { kubeClient, qontoClient, qontoClientId, userId } = ctx

	// User namespace for storing the Qonto client ID
	const userNamespace = `ctnr-user-${userId}`

	// Check if client already exists
	let existingClient = null
	if (qontoClientId) {
		try {
			existingClient = await qontoClient.getClientSDetails({ id: qontoClientId })
		} catch {
			// Client doesn't exist or error
		}
	}

	// Build Qonto client request
	const qontoClientRequest = billingClientToQonto(client)

	let newClientId: string

	if (existingClient?.client?.id) {
		// Update existing client
		await qontoClient.updateClient({ id: qontoClientId }, qontoClientRequest)
		newClientId = qontoClientId
	} else {
		// Create new client
		const response = await qontoClient.createClient(qontoClientRequest)
		if (!response.client?.id) {
			throw new Error('Failed to create Qonto client')
		}
		newClientId = response.client.id

		// Store client ID in user namespace
		await kubeClient.CoreV1.patchNamespace(userNamespace, 'json-merge', {
			metadata: {
				labels: {
					'ctnr.io/qonto-client-id': newClientId,
				},
			},
		}, { abortSignal: signal })
	}

	return newClientId
}

/**
 * Delete billing client
 */
export async function deleteBillingClient(
	ctx: BillingClientContext,
	signal?: AbortSignal,
): Promise<void> {
	const { kubeClient, qontoClient, qontoClientId, userId } = ctx

	if (!qontoClientId) return

	const userNamespace = `ctnr-user-${userId}`

	// Delete from Qonto
	try {
		await qontoClient.deleteClient({ id: qontoClientId })
	} catch {
		// Ignore errors if client doesn't exist
	}

	// Remove from namespace labels
	// deno-lint-ignore no-explicit-any
	await kubeClient.CoreV1.patchNamespace(userNamespace, 'json-merge', {
		metadata: {
			labels: {
				'ctnr.io/qonto-client-id': null,
			},
		},
	} as any, { abortSignal: signal })
}
