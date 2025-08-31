import { createServerContext } from 'ctx/server/mod.ts'
import { ServerRequest, ServerResponse } from '../../_common.ts'
import { z } from 'zod'

export const Meta = {}

export const Input = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export type Input = z.infer<typeof Input>

export type Output = {
  invoices: Array<{
    id: string
    number: string
    amount: {
      value: string
      currency: string
    }
    description: string
    status: 'paid' | 'pending' | 'failed' | 'draft'
    createdAt: string
    paidAt?: string
    dueAt: string
    credits: number
    downloadUrl?: string
  }>
  total: number
}

export default async function* GetInvoices({ ctx, input, signal, defer }: ServerRequest<Input>): ServerResponse<Output> {
  yield `Fetching invoices...`

  try {
    // In a real implementation, this would:
    // 1. Query the database for invoices belonging to the current user
    // 2. Include pagination based on input.limit and input.offset
    // 3. Generate download URLs for paid invoices
    
    // Mock invoice data for now
    const mockInvoices = [
      {
        id: 'inv_001',
        number: 'INV-2024-001',
        amount: { value: '4.50', currency: 'EUR' },
        description: '500 Credits Purchase',
        status: 'paid' as const,
        createdAt: '2024-01-15T10:30:00Z',
        paidAt: '2024-01-15T10:31:00Z',
        dueAt: '2024-01-22T10:30:00Z',
        credits: 500,
        downloadUrl: '/api/billing/invoices/inv_001/download'
      },
      {
        id: 'inv_002',
        number: 'INV-2024-002',
        amount: { value: '1.00', currency: 'EUR' },
        description: '100 Credits Purchase',
        status: 'paid' as const,
        createdAt: '2024-01-10T14:20:00Z',
        paidAt: '2024-01-10T14:21:00Z',
        dueAt: '2024-01-17T14:20:00Z',
        credits: 100,
        downloadUrl: '/api/billing/invoices/inv_002/download'
      },
      {
        id: 'inv_003',
        number: 'INV-2024-003',
        amount: { value: '8.00', currency: 'EUR' },
        description: '1000 Credits Purchase',
        status: 'pending' as const,
        createdAt: '2024-01-08T09:15:00Z',
        dueAt: '2024-01-15T09:15:00Z',
        credits: 1000
      }
    ]

    // Filter by user (in real implementation, this would be done in the database query)
    const userInvoices = mockInvoices.filter(() => true) // All invoices for mock

    // Apply pagination
    const paginatedInvoices = userInvoices.slice(input.offset, input.offset + input.limit)

    return {
      invoices: paginatedInvoices,
      total: userInvoices.length,
    }
  } catch (error: any) {
    throw new Error(`Failed to fetch invoices: ${error.message}`)
  }
}
