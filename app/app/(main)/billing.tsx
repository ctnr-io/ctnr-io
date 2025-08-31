'use dom'

import React, { useEffect, useState } from 'react'
import {
  Calendar,
  Cpu,
  CreditCard,
  Crown,
  DollarSign,
  Download,
  HardDrive,
  MemoryStick,
  Plus,
  Receipt,
  Rocket,
  Star,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Card, CardContent, CardFooter, CardHeader } from 'app/components/shadcn/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'app/components/shadcn/ui/tabs.tsx'
import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { Tier } from '../../../lib/billing/utils.ts'
import { useMutation } from '@tanstack/react-query'

interface Invoice {
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
}

export default function BillingScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [currentBalance] = useState(1250) // Mock current balance
  const [currentTier] = useState<Tier>('free') // Mock current tier

  const trpc = useTRPC()

  const loadInvoices = async () => {
    setLoading(true)
    try {
      // Mock invoice data - in real implementation, this would use tRPC
      const mockInvoices: Invoice[] = [
        {
          id: 'inv_001',
          number: 'INV-2024-001',
          amount: { value: '4.50', currency: 'EUR' },
          description: '500 Credits Purchase',
          status: 'paid',
          createdAt: '2024-01-15T10:30:00Z',
          paidAt: '2024-01-15T10:31:00Z',
          dueAt: '2024-01-22T10:30:00Z',
          credits: 500,
          downloadUrl: '/invoices/inv_001.pdf',
        },
        {
          id: 'inv_002',
          number: 'INV-2024-002',
          amount: { value: '1.00', currency: 'EUR' },
          description: '100 Credits Purchase',
          status: 'paid',
          createdAt: '2024-01-10T14:20:00Z',
          paidAt: '2024-01-10T14:21:00Z',
          dueAt: '2024-01-17T14:20:00Z',
          credits: 100,
          downloadUrl: '/invoices/inv_002.pdf',
        },
        {
          id: 'inv_003',
          number: 'INV-2024-003',
          amount: { value: '8.00', currency: 'EUR' },
          description: '1000 Credits Purchase',
          status: 'pending',
          createdAt: '2024-01-08T09:15:00Z',
          dueAt: '2024-01-15T09:15:00Z',
          credits: 1000,
        },
      ]
      setInvoices(mockInvoices)
    } catch (error) {
      console.error('Failed to load invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const purchaseCredits = async () => {
    setPurchasing(true)
    try {
      // In real implementation, this would call the tRPC buyCredits mutation
      console.log('Opening credit purchase dialog')

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock success - would redirect to payment URL in real implementation
      alert('Redirecting to credit purchase page...')
    } catch (error) {
      console.error('Failed to initiate purchase:', error)
      alert('Failed to initiate purchase. Please try again.')
    } finally {
      setPurchasing(false)
    }
  }

  const { mutateAsync: subscribeTierMutation } = useMutation(trpc.billing.subscribeTier.mutationOptions())

  const subscribeTier = async (tier: Tier) => {
    if (tier === 'free' || tier === 'custom') return

    setSubscribing(tier)
    try {
      // Use the subscription method correctly
      const subscription = await subscribeTierMutation({ tier })
      // Redirect to payment URL
      window.location.href = subscription.paymentUrl
    } catch (error) {
      console.error('Failed to initiate tier subscription:', error)
      alert('Failed to initiate tier subscription. Please try again.')
    } finally {
      setSubscribing(null)
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'nano':
        return Zap
      case 'tiny':
        return Zap
      case 'micro':
        return Star
      case 'small':
        return Rocket
      case 'medium':
        return Crown
      case 'large':
        return Crown
      case 'huge':
        return Crown
      case 'giant':
        return Crown
      default:
        return Star
    }
  }

  const getTierColor = (tier: string, isCurrentTier: boolean) => {
    if (isCurrentTier) {
      return 'border-gray-900 bg-gray-50'
    }
    return 'border-gray-200 hover:bg-gray-50'
  }

  const formatTierName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  const formatResources = (tierConfig: any) => {
    return {
      cpu: `${(tierConfig.cpu / 1000).toFixed(1)} CPU`,
      memory: `${(tierConfig.memory / 1024).toFixed(1)}GB RAM`,
      storage: `${(tierConfig.storage / 1024).toFixed(1)}GB Storage`,
    }
  }

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
    {
      key: 'dueAt',
      label: 'Due Date',
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
          window.open(invoice.downloadUrl, '_blank')
        } else {
          alert('Invoice not available for download')
        }
      },
      condition: (invoice) => invoice.status === 'paid' && !!invoice.downloadUrl,
    },
  ]

  useEffect(() => {
    loadInvoices()
  }, [])

  return (
    <div className='max-w-7xl p-6'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900'>Billing</h1>
        <p className='text-gray-600 mt-2'>Manage your credits, subscriptions, and billing history</p>
      </div>

      <Tabs defaultValue='overview' className='space-y-6'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='overview' className='flex items-center gap-2 transition-all duration-500'>
            <Wallet className='h-4 w-4' />
            Overview
          </TabsTrigger>
          <TabsTrigger value='plans' className='flex items-center gap-2 transition-all duration-500'>
            <Crown className='h-4 w-4' />
            Plans
          </TabsTrigger>
          <TabsTrigger value='invoices' className='flex items-center gap-2 transition-all duration-500'>
            <Receipt className='h-4 w-4' />
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-6 '>
          {/* Current Balance & Quick Actions */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <Card className='lg:col-span-2 p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 text-sm font-medium'>Current Balance</p>
                  <p className='text-4xl font-bold text-gray-900 mt-1'>{currentBalance.toLocaleString()}</p>
                  <p className='text-gray-500 text-sm mt-1'>Credits available</p>
                </div>
                <div className='text-right'>
                  <Button
                    onClick={purchaseCredits}
                    disabled={purchasing}
                    className='bg-gray-900 text-white hover:bg-gray-800'
                    size='sm'
                  >
                    {purchasing
                      ? (
                        <div className='flex items-center gap-2'>
                          <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-current'></div>
                          Loading...
                        </div>
                      )
                      : (
                        <div className='flex items-center gap-2'>
                          <Plus className='h-3 w-3' />
                          Buy Credits
                        </div>
                      )}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className='p-6'>
              <div>
                <p className='text-gray-600 text-sm font-medium'>Current Plan</p>
                <p className='text-2xl font-bold text-gray-900 capitalize mt-1'>{currentTier}</p>
                {currentTier === 'free' && (
                  <p className='text-sm text-gray-500 mt-1'>Consider upgrading for better rates</p>
                )}
              </div>
            </Card>
          </div>

          {/* Usage Stats */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <Card className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 text-sm font-medium'>This Month</p>
                  <p className='text-3xl font-bold text-gray-900'>€12.50</p>
                  <p className='text-gray-500 text-sm'>Total spent</p>
                </div>
                <DollarSign className='h-8 w-8 text-gray-400' />
              </div>
            </Card>

            <Card className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 text-sm font-medium'>Daily Usage</p>
                  <p className='text-3xl font-bold text-gray-900'>~50</p>
                  <p className='text-gray-500 text-sm'>Credits per day</p>
                </div>
                <TrendingUp className='h-8 w-8 text-gray-400' />
              </div>
            </Card>
          </div>

          {/* How Pricing Works - Simplified */}
          <Card className='p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>How Pricing Works</h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center'>
                  <CreditCard className='h-4 w-4 text-orange-600' />
                </div>
                <div>
                  <h4 className='font-medium text-gray-900'>Pay-as-you-go</h4>
                  <p className='text-sm text-gray-600 mt-1'>Higher rates, no commitment. Perfect for testing.</p>
                </div>
              </div>
              <div className='flex items-start gap-3'>
                <div className='flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center'>
                  <Crown className='h-4 w-4 text-green-600' />
                </div>
                <div>
                  <h4 className='font-medium text-gray-900'>Subscription Plans</h4>
                  <p className='text-sm text-gray-600 mt-1'>Up to 70% savings with included resources.</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value='plans' className='space-y-6'>
          <div className='text-center mb-8'>
            <h2 className='text-2xl font-bold text-gray-900 mb-2'>Choose Your Plan</h2>
            <p className='text-gray-600'>
              Current: <span className='font-semibold capitalize'>{currentTier}</span>
              {currentTier === 'free' && (
                <span className='ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full'>
                  Upgrade to save up to 70%
                </span>
              )}
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            {Object.entries(Tier).filter(([key]) => key !== 'free').map(([tierKey, tierConfig]) => {
              const isCurrentTier = currentTier === tierKey
              const resources = formatResources(tierConfig)
              const monthlyPrice = (tierConfig.monthlyCreditCost * 0.01).toFixed(2)
              const payAsYouGoEquivalent = (parseFloat(monthlyPrice) * 3).toFixed(2)
              const savingsPercentage = Math.round(
                ((parseFloat(payAsYouGoEquivalent) - parseFloat(monthlyPrice)) / parseFloat(payAsYouGoEquivalent)) *
                  100,
              )

              return (
                <Card
                  key={tierKey}
                  className={`${getTierColor(tierKey, isCurrentTier)} transition-all duration-200`}
                >
                  <CardHeader>
                    <h3 className='text-lg font-semibold text-gray-900 mb-2'>{formatTierName(tierKey)}</h3>
                    <div className='text-2xl font-bold text-gray-900'>
                      €{monthlyPrice}
                      <span className='text-sm font-normal text-gray-500'>/month</span>
                    </div>
                    <p className='text-sm text-gray-500 mt-1'>
                      {tierConfig.monthlyCreditCost.toLocaleString()} credits included
                    </p>
                    {!isCurrentTier && (
                      <p className='text-xs text-gray-400 mt-1'>
                        Save {savingsPercentage}% vs pay-as-you-go
                      </p>
                    )}
                  </CardHeader>

                  <CardContent>
                    <div className='flex items-center gap-2'>
                      <Cpu className='h-3 w-3' />
                      <span>{resources.cpu}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <MemoryStick className='h-3 w-3' />
                      <span>{resources.memory}</span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <HardDrive className='h-3 w-3' />
                      <span>{resources.storage}</span>
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      onClick={() => subscribeTier(tierKey as Tier)}
                      disabled={isCurrentTier || subscribing === tierKey}
                      className={`w-full cursor-pointer ${
                        isCurrentTier
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-gray-800 text-white'
                      }`}
                      variant={isCurrentTier ? 'outline' : 'default'}
                    >
                      {subscribing === tierKey
                        ? (
                          <div className='flex items-center gap-2'>
                            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-current'></div>
                            Processing...
                          </div>
                        )
                        : isCurrentTier
                        ? (
                          'Current Plan'
                        )
                        : (
                          `Upgrade to ${formatTierName(tierKey)}`
                        )}
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value='invoices'>
          <DataTableScreen<Invoice>
            title='Billing History'
            description='View and download your invoices'
            icon={Receipt}
            data={invoices}
            columns={columns}
            actions={actions}
            tableTitle='All Invoices'
            tableDescription={`${invoices.length} invoices • ${
              invoices.filter((i) => i.status === 'paid').length
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
            emptyMessage='No invoices found. Your purchases will appear here.'
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
