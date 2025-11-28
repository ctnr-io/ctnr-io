/**
 * Billing Client Repository
 * Handles billing/invoicing client information (Qonto integration)
 * 
 * Owner-scoped: billing client info is stored per user, not per project
 */
import type { KubeClient } from 'core/adapters/kubernetes/kube-client.ts'
import type { QontoClient } from 'core/adapters/qonto/mod.ts'
import type { CreateClientRequest } from 'core/adapters/qonto/client.ts'
import type { BillingClient } from 'core/entities/billing/client.ts'
import type { KubeCluster } from './base_repository.ts'
import { match } from 'ts-pattern'

/**
 * Billing Client Repository
 * Manages billing client information stored in Qonto
 * Client ID is stored in user namespace labels
 */
export class BillingClientRepository {
  constructor(
    private readonly kubeClient: Record<KubeCluster, KubeClient>,
    private readonly qontoClient: QontoClient,
    private readonly qontoClientId: string | undefined,
    private readonly ownerId: string,
  ) {}

  /**
   * Karmada client for namespace operations
   */
  private get karmada(): KubeClient {
    return this.kubeClient['karmada']
  }

  /**
   * Owner namespace (user namespace)
   */
  private get namespace(): string {
    return `ctnr-user-${this.ownerId}`
  }

  /**
   * Get the current billing client
   */
  async get(_signal?: AbortSignal): Promise<BillingClient | null> {
    if (!this.qontoClientId) {
      return this.getDefaultClient()
    }

    try {
      const response = await this.qontoClient.getClientSDetails({ id: this.qontoClientId }) as {
        client: CreateClientRequest
      }
      return this.transformQontoClientToBillingClient(response.client)
    } catch {
      return this.getDefaultClient()
    }
  }

  /**
   * Check if billing client exists
   */
  async exists(_signal?: AbortSignal): Promise<boolean> {
    if (!this.qontoClientId) {
      return false
    }
    
    try {
      await this.qontoClient.getClientSDetails({ id: this.qontoClientId })
      return true
    } catch {
      return false
    }
  }

  /**
   * Create or update billing client
   */
  async upsert(input: BillingClient, signal?: AbortSignal): Promise<BillingClient> {
    const abortSignal = signal ?? new AbortController().signal
    const qontoInput = this.transformBillingClientToQontoClient(input)

    // If existing client, delete it first
    if (this.qontoClientId) {
      try {
        await this.qontoClient.deleteClient({ id: this.qontoClientId })
      } catch (error) {
        console.warn(`Failed to delete existing Qonto client ${this.qontoClientId}:`, error)
      }
    }

    // Create new client
    const response = await this.qontoClient.createClient(qontoInput)
    if (!response.client?.id) {
      throw new Error('Failed to create Qonto client')
    }

    // Update namespace with new client ID
    await this.karmada.CoreV1.patchNamespace(this.namespace, 'json-merge', {
      metadata: {
        labels: {
          'ctnr.io/qonto-client-id': response.client.id,
        },
      },
    }, { abortSignal })

    return this.transformQontoClientToBillingClient(response.client as CreateClientRequest)
  }

  /**
   * Delete billing client
   */
  async delete(signal?: AbortSignal): Promise<void> {
    const abortSignal = signal ?? new AbortController().signal
    
    if (!this.qontoClientId) {
      return
    }

    try {
      await this.qontoClient.deleteClient({ id: this.qontoClientId })
    } catch (error) {
      console.warn(`Failed to delete Qonto client ${this.qontoClientId}:`, error)
    }

    // Remove client ID from namespace (use empty string to remove)
    await this.karmada.CoreV1.patchNamespace(this.namespace, 'json-merge', {
      metadata: {
        labels: {
          'ctnr.io/qonto-client-id': '',
        },
      },
    }, { abortSignal })
  }

  /**
   * Get default client for new users
   */
  private getDefaultClient(): BillingClient {
    return {
      type: 'individual',
      firstName: '',
      lastName: '',
      currency: 'EUR',
      locale: 'fr',
      billingAddress: {
        streetAddress: '',
        city: '',
        postalCode: '',
        countryCode: '',
      },
    }
  }

  /**
   * Transform Qonto client to BillingClient DTO
   */
  private transformQontoClientToBillingClient(qontoClient: CreateClientRequest): BillingClient {
    const baseFields = {
      currency: (qontoClient.currency as 'EUR') ?? 'EUR',
      locale: (qontoClient.locale as 'fr') ?? 'fr',
      billingAddress: {
        streetAddress: qontoClient.billing_address?.street_address ?? '',
        city: qontoClient.billing_address?.city ?? '',
        postalCode: qontoClient.billing_address?.zip_code ?? '',
        countryCode: qontoClient.billing_address?.country_code ?? '',
        provinceCode: qontoClient.billing_address?.province_code,
      },
    }

    if (qontoClient.type === 'company') {
      return {
        type: 'company',
        name: qontoClient.name ?? '',
        taxIdentificationNumber: qontoClient.tax_identification_number ?? '',
        vatNumber: qontoClient.vat_number,
        ...baseFields,
      }
    }

    return {
      type: 'individual',
      firstName: qontoClient.first_name ?? '',
      lastName: qontoClient.last_name ?? '',
      ...baseFields,
    }
  }

  /**
   * Transform BillingClient DTO to Qonto client format
   */
  private transformBillingClientToQontoClient(billingClient: BillingClient): CreateClientRequest {
    const baseFields: CreateClientRequest = {
      type: billingClient.type,
      currency: billingClient.currency,
      locale: billingClient.locale,
      billing_address: billingClient.billingAddress ? {
        street_address: billingClient.billingAddress.streetAddress,
        city: billingClient.billingAddress.city,
        zip_code: billingClient.billingAddress.postalCode,
        country_code: billingClient.billingAddress.countryCode,
        province_code: billingClient.billingAddress.provinceCode,
      } : undefined,
    }

    return match(billingClient)
      .with({ type: 'individual' }, (client) => ({
        ...baseFields,
        first_name: client.firstName,
        last_name: client.lastName,
        vat_number: '',
      }))
      .with({ type: 'company' }, (client) => ({
        ...baseFields,
        name: client.name,
        tax_identification_number: client.taxIdentificationNumber,
        vat_number: client.vatNumber,
      }))
      .exhaustive()
  }
}
