/**
 * Invoice Repository
 * Handles invoice/payment operations from Mollie
 */
import type { MollieClient } from '../adapters/mollie/mod.ts'
import { PaymentStatus } from '@mollie/api-client'
import { match } from 'ts-pattern'
import type { Invoice, InvoiceSummary } from 'core/entities/billing/invoice.ts'
import type { PaymentMetadataV1 } from 'core/application/billing/utils.ts'

/**
 * List invoices options
 */
export interface ListInvoicesOptions {
  cursor?: string
  limit?: number
}

/**
 * Invoice Repository
 * Read-only repository for invoices from Mollie payments
 */
export class InvoiceRepository {
  constructor(
    private readonly mollieClient: MollieClient,
    private readonly mollieCustomerId: string,
  ) {}

  /**
   * List all invoices for the customer
   */
  async list(options: ListInvoicesOptions = {}): Promise<Invoice[]> {
    const { cursor, limit = 20 } = options

    const payments = await this.mollieClient.customerPayments.page({
      customerId: this.mollieCustomerId,
      limit,
      from: cursor,
    })

    return payments.map((payment) => this.transformPaymentToInvoice(payment))
  }

  /**
   * List invoice summaries (same as full for invoices)
   */
  async listSummaries(options: ListInvoicesOptions = {}): Promise<InvoiceSummary[]> {
    return this.list(options)
  }

  /**
   * Get a single invoice by ID
   */
  async get(id: string): Promise<Invoice | null> {
    try {
      const payment = await this.mollieClient.payments.get(id)
      return this.transformPaymentToInvoice(payment)
    } catch {
      return null
    }
  }

  /**
   * Check if an invoice exists
   */
  async exists(id: string): Promise<boolean> {
    const invoice = await this.get(id)
    return invoice !== null
  }

  /**
   * Transform Mollie payment to Invoice DTO
   */
  private transformPaymentToInvoice(payment: {
    id: string
    amount: { value: string; currency: string }
    description: string
    status: PaymentStatus
    createdAt: string
    paidAt?: string | null
    expiredAt?: string | null
    metadata: unknown
  }): Invoice {
    const metadata = payment.metadata as PaymentMetadataV1

    return {
      id: payment.id,
      amount: {
        value: payment.amount.value,
        currency: payment.amount.currency,
      },
      description: payment.description,
      status: this.mapPaymentStatus(payment.status),
      createdAt: payment.createdAt,
      paidAt: payment.paidAt ?? undefined,
      expiredAt: payment.expiredAt ?? undefined,
      credits: metadata?.credits ?? 0,
      downloadUrl: metadata?.invoiceUrl ?? undefined,
    }
  }

  /**
   * Map Mollie payment status to invoice status
   */
  private mapPaymentStatus(status: PaymentStatus): 'paid' | 'pending' | 'failed' {
    return match(status)
      .with(PaymentStatus.open, () => 'pending' as const)
      .with(PaymentStatus.canceled, () => 'failed' as const)
      .with(PaymentStatus.pending, () => 'pending' as const)
      .with(PaymentStatus.authorized, () => 'pending' as const)
      .with(PaymentStatus.expired, () => 'failed' as const)
      .with(PaymentStatus.failed, () => 'failed' as const)
      .with(PaymentStatus.paid, () => 'paid' as const)
      .exhaustive()
  }
}
