'use dom'

import React, { useState } from 'react'
import { AlertTriangle, CreditCard, Download, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Card } from 'app/components/shadcn/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'app/components/shadcn/ui/tabs.tsx'
import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription } from 'app/components/shadcn/ui/alert.tsx'
import { Invoice } from 'lib/billing/utils.ts'
import { CreditPurchaseDialog } from 'app/components/ctnr-io/billing-purchase-credits-dialog.tsx'

export default function BillingScreen() {
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)

  const trpc = useTRPC()

  // Fetch data using tRPC queries
  const { data: usageData, isLoading: usageLoading } = useQuery(trpc.billing.getUsage.queryOptions({}))
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery(
    trpc.billing.getInvoices.queryOptions({ limit: 50 }),
  )

  // Debug logging
  console.log('Usage Data:', usageData)
  console.log('Invoices Data:', invoicesData)
  console.log('Usage Loading:', usageLoading)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-50'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50'
      case 'failed':
        return 'text-red-600 bg-red-50'
      case 'draft':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  // Define table columns for invoices
  const columns: TableColumn<Invoice>[] = [
    {
      key: 'number',
      label: 'Invoice',
      render: (value, item) => (
        <div className='flex items-center gap-2'>
          <Receipt className='h-4 w-4 text-gray-400' />
          <span className='font-medium'>{value}</span>
        </div>
      ),
      className: 'font-medium',
    },
    {
      key: 'description',
      label: 'Description',
      className: 'text-sm',
    },
    {
      key: 'credits',
      label: 'Credits',
      render: (value) => (
        <span className='font-mono text-sm'>
          +{value.toLocaleString()}
        </span>
      ),
      className: 'text-blue-600 font-medium',
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => (
        <span className='font-semibold text-green-600'>
          {value.currency} {value.value}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      render: (value) => formatDate(value),
      className: 'text-sm text-muted-foreground',
    },
  ]

  // Define table actions for invoices
  const actions: TableAction<Invoice>[] = [
    {
      icon: Download,
      label: 'Download Invoice',
      onClick: (invoice) => {
        if (invoice.downloadUrl) {
          globalThis.open(invoice.downloadUrl, '_blank')
        }
      },
      condition: (invoice) => invoice.status === 'paid' && !!invoice.downloadUrl,
    },
  ]

  // Use actual data from the updated API
  const currentBalance = usageData?.credits?.balance ?? 0
  const isPaidPlan = usageData?.tier?.type !== 'free'
  const invoices = invoicesData || []
  const dailyUsage = usageData?.costs?.daily ?? 0
  const monthlyUsage = usageData?.costs?.monthly ?? 0
  const hourlyUsage = usageData?.costs?.hourly ?? 0
  const usage = usageData?.usage
  const status = usageData?.status ?? 'normal'
  const containers = usageData?.containers ?? []

  // Calculate days remaining for insufficient credits warning
  const daysRemaining = dailyUsage > 0 ? Math.floor(currentBalance / dailyUsage) : 0

  return (
    <div className='w-full max-w-6xl mx-auto py-6 px-4'>
      <div className='mb-8'>
        <h1 className='text-2xl font-semibold text-gray-900 mb-2'>Billing</h1>
        <p className='text-gray-500 text-sm'>Manage your credits and usage</p>
      </div>

      {/* Warning Alerts */}
      {(status === 'limit_reached' || status === 'insufficient_credits') && (
        <Card className='mb-6 space-y-4 px-4 '>
          {status === 'limit_reached' && (
            <div className='flex items-start gap-3'>
              <AlertTriangle className='h-5 w-5 flex-shrink-0 mt-0.5' />
              <div className='flex-1'>
                <h4 className='font-semibold mb-1'>Resource Limit Reached</h4>
                <p className='text-sm mb-3'>
                  One or more of your resources (CPU, Memory, or Storage) has reached its limit. Your containers may be
                  throttled or stopped.
                </p>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    onClick={() => {
                      setPurchaseDialogOpen(true)
                    }}
                  >
                    <Plus className='h-3 w-3' />
                    Add Credits
                  </Button>
                </div>
              </div>
            </div>
          )}

          {status === 'insufficient_credits' && (
            <div className='flex items-start gap-3'>
              <AlertTriangle className='h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5' />
              <div className='flex-1'>
                <h4 className='font-semibold text-amber-800 mb-1'>Low Credit Balance</h4>
                <p className='text-sm text-amber-700 mb-3'>
                  Your current balance ({currentBalance.toLocaleString()}{' '}
                  credits) is below your daily usage (~{dailyUsage.toLocaleString()} credits/day).
                  {daysRemaining > 0
                    ? ` You have approximately ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining.`
                    : ' Your services may be limited soon.'}
                </p>
                <div className='flex gap-2'>
                  <Button
                    size='sm'
                    onClick={() => {
                      setPurchaseDialogOpen(true)
                    }}
                  >
                    Add Credits
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <Tabs defaultValue='overview' className='space-y-6'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='overview' className='text-sm font-medium'>
            Overview
          </TabsTrigger>
          <TabsTrigger value='invoices' className='text-sm font-medium'>
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-6'>
          {/* Balance and Plan */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Card className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-gray-500 mb-1'>Balance</p>
                  <p className='text-3xl font-bold text-gray-900'>{currentBalance?.toLocaleString() || '0'}</p>
                  <p className='text-xs text-gray-400 mt-1'>credits</p>
                </div>
                <Button
                  onClick={() => setPurchaseDialogOpen(true)}
                  size='sm'
                  className='bg-black hover:bg-gray-800 text-white text-xs px-3 py-1.5'
                >
                  <Plus className='h-3 w-3 mr-1' />
                  Add Credits
                </Button>
              </div>
            </Card>

            <Card className='p-6'>
              <div>
                <p className='text-sm text-gray-500 mb-1'>Plan</p>
                <p className='text-2xl font-bold text-gray-900'>{isPaidPlan ? 'Paid' : 'Free'}</p>
                <p className='text-xs text-gray-400 mt-1'>
                  {isPaidPlan ? 'Pay-as-you-go' : '1 CPU • 2GB RAM • 10GB storage'}
                </p>
              </div>
            </Card>
          </div>

          {/* Usage Stats */}
          <div className='grid grid-cols-3 gap-4'>
            <Card className='p-4'>
              <div className='text-center'>
                <p className='text-xs text-gray-500 mb-1'>Monthly</p>
                <p className='text-xl font-semibold text-gray-900'>
                  {monthlyUsage ? monthlyUsage.toLocaleString() : '0'}
                </p>
                <p className='text-xs text-gray-400'>credits</p>
              </div>
            </Card>

            <Card className='p-4'>
              <div className='text-center'>
                <p className='text-xs text-gray-500 mb-1'>Daily</p>
                <p className='text-xl font-semibold text-gray-900'>{dailyUsage ? dailyUsage.toLocaleString() : '0'}</p>
                <p className='text-xs text-gray-400'>credits</p>
              </div>
            </Card>

            <Card className='p-4'>
              <div className='text-center'>
                <p className='text-xs text-gray-500 mb-1'>Hourly</p>
                <p className='text-xl font-semibold text-gray-900'>
                  {hourlyUsage ? hourlyUsage.toLocaleString() : '0'}
                </p>
                <p className='text-xs text-gray-400'>credits</p>
              </div>
            </Card>
          </div>

          {/* Resource Usage */}
          {usage && (
            <Card className='p-6'>
              <h3 className='text-sm font-medium text-gray-900 mb-4'>Resources</h3>
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='w-2 h-2 rounded-full bg-blue-500'></div>
                    <span className='text-sm text-gray-700'>CPU</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500'>
                      {usage.cpu.used.toLocaleString()}m /{' '}
                      {usage.cpu.limit === Infinity ? '∞' : `${usage.cpu.limit.toLocaleString()}m`}
                    </span>
                    <span className='text-xs font-medium text-gray-900'>{usage.cpu.percentage}%</span>
                  </div>
                </div>

                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='w-2 h-2 rounded-full bg-green-500'></div>
                    <span className='text-sm text-gray-700'>Memory</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500'>
                      {usage.memory.used.toLocaleString()}MB /{' '}
                      {usage.memory.limit === Infinity ? '∞' : `${usage.memory.limit.toLocaleString()}MB`}
                    </span>
                    <span className='text-xs font-medium text-gray-900'>{usage.memory.percentage}%</span>
                  </div>
                </div>

                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='w-2 h-2 rounded-full bg-purple-500'></div>
                    <span className='text-sm text-gray-700'>Storage</span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500'>
                      {usage.storage.used.toLocaleString()}GB /{' '}
                      {usage.storage.limit === Infinity ? '∞' : `${usage.storage.limit.toLocaleString()}GB`}
                    </span>
                    <span className='text-xs font-medium text-gray-900'>{usage.storage.percentage}%</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Pricing */}
          <Card className='p-6'>
            <h3 className='text-sm font-medium text-gray-900 mb-4'>Pricing</h3>
            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-gray-600'>CPU per hour</span>
                <span className='text-sm font-mono text-gray-900'>0.01 credits</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-gray-600'>Memory per MB/hour</span>
                <span className='text-sm font-mono text-gray-900'>0.01 credits</span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-sm text-gray-600'>Storage per GB/hour</span>
                <span className='text-sm font-mono text-gray-900'>0.002 credits</span>
              </div>
              <div className='border-t pt-3 mt-3'>
                <div className='flex justify-between items-center'>
                  <span className='text-sm text-gray-600'>1 credit equals</span>
                  <span className='text-sm font-medium text-gray-900'>€0.01</span>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value='invoices' className='-mx-4'>
          <DataTableScreen<Invoice>
            title='Billing History'
            description='View and download your invoices'
            icon={Receipt}
            data={invoices}
            columns={columns}
            actions={actions}
            tableTitle='All Invoices'
            tableDescription={`${invoices.length} invoices • ${
              invoices.filter((i: Invoice) => i.status === 'paid').length
            } paid`}
            mobileCardTitle={(item) => item.number}
            mobileCardStatus={(item) => ({
              label: item.status,
              className: getStatusColor(item.status),
            })}
            mobileCardIcon={() => <Receipt className='h-4 w-4' />}
            searchable
            searchPlaceholder='Search invoices...'
            searchKeys={['number', 'description', 'status']}
            columnFilterable
            defaultVisibleColumns={['number', 'description', 'credits', 'amount', 'status', 'createdAt']}
            mobileVisibleColumns={['credits']}
            emptyMessage='No invoices found. Your purchases will appear here.'
            loading={invoicesLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreditPurchaseDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} />
    </div>
  )
}
