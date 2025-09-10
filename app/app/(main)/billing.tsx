'use dom'

import { useState } from 'react'
import {
  AlertTriangle,
  Cpu,
  CreditCard,
  Database,
  Download,
  HardDrive,
  MemoryStick,
  Plus,
  Receipt,
  Settings,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'app/components/shadcn/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'app/components/shadcn/ui/tabs.tsx'
import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription } from 'app/components/shadcn/ui/alert.tsx'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Progress } from 'app/components/shadcn/ui/progress.tsx'
import { CreditPurchaseDialog } from 'app/components/ctnr-io/billing-purchase-credits-dialog.tsx'
import { ResourceLimitsDialog } from 'app/components/ctnr-io/resource-limits-dialog.tsx'

export default function BillingScreen() {
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)
  const [resourceLimitsDialogOpen, setResourceLimitsDialogOpen] = useState(false)

  const trpc = useTRPC()

  // Fetch data using tRPC queries
  const { data: usageData, isLoading: usageLoading } = useQuery(trpc.billing.getUsage.queryOptions({}))

  // Infinite query for invoices
  const invoiceLimit = 20
  const [page, setPage] = useState(0)
  const {
    data: invoicePages,
    isLoading: invoicesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.billing.getInvoices.infiniteQueryOptions({
      cursor: undefined,
      limit: invoiceLimit,
    }, {
      getNextPageParam: (lastPage) => {
        if (lastPage.length < invoiceLimit) return undefined
        return lastPage[lastPage.length - 1].id
      },
    }),
  )

  // Flatten all invoices from pages
  const invoices = invoicePages?.pages[page] ?? []

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-primary bg-primary/10 border-primary/20'
      case 'pending':
        return 'text-chart-4 bg-chart-4/10 border-chart-4/20'
      case 'failed':
        return 'text-destructive bg-destructive/10 border-destructive/20'
      case 'draft':
        return 'text-muted-foreground bg-muted border-border'
      default:
        return 'text-muted-foreground bg-muted border-border'
    }
  }

  // Define table columns for invoices
  const columns: TableColumn<typeof invoices[number]>[] = [
    {
      key: 'createdAt',
      label: 'Invoice',
      render: (value) => (
        <div className='flex items-center gap-2'>
          <Receipt className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{formatDate(value)}</span>
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
        <Badge variant='secondary' className='font-mono'>
          +{value.toLocaleString()}
        </Badge>
      ),
      className: 'font-medium',
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (value) => (
        <span className='font-semibold'>
          {value.currency} {value.value}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge
          variant='outline'
          className={getStatusColor(value)}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      ),
    },
  ]

  // Define table actions for invoices
  const actions: TableAction[] = [
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
  const currentBalance = usageData?.balance.credits ?? 0
  const tier = usageData?.tier ?? 'free'
  const isPaidPlan = usageData?.tier !== 'free'
  // Map backend invoices to Invoice type expected by DataTableScreen

  const dailyUsage = usageData?.costs?.current?.daily ?? 0
  const monthlyUsage = usageData?.costs?.current?.monthly ?? 0
  const hourlyUsage = usageData?.costs?.current?.hourly ?? 0
  const resources = usageData?.resources ?? null
  const status = usageData?.status ?? 'normal'

  if (usageLoading) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='container mx-auto px-6 py-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-foreground mb-2'>Billing</h1>
            <p className='text-muted-foreground'>Manage your credits and usage</p>
          </div>
          <div className='flex items-center justify-center py-20'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
              <p className='text-muted-foreground text-lg'>Loading billing information...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-6 py-8'>
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-foreground mb-2'>Billing</h1>
          <p className='text-muted-foreground'>Manage your credits and usage</p>
        </div>

        {/* Warning Alerts */}
        {(status === 'resource_limits_reached_for_current_usage' ||
          status === 'insufficient_credits_for_current_usage') && (
          <Alert className='mb-6' variant='destructive'>
            <AlertTriangle className='h-5 w-5' />
            <AlertDescription>
              <div className='flex-1'>
                <h4 className='font-semibold mb-2'>
                  {status === 'resource_limits_reached_for_current_usage'
                    ? 'Resource Limit Reached'
                    : 'Insufficient Credits'}
                </h4>
                <p className='text-sm mb-4'>
                  {status === 'resource_limits_reached_for_current_usage'
                    ? 'One or more of your resources (CPU, Memory, or Storage) has reached its limit. Your containers may be throttled or stopped.'
                    : `Your current balance (${currentBalance.toLocaleString()} credits) is below your hourly usage (~${hourlyUsage.toLocaleString()} credits/hours). You have 24h from the start of the threshold breach to add credits.`}
                </p>
                <Button
                  size='sm'
                  onClick={() => {
                    status === 'resource_limits_reached_for_current_usage'
                      ? setResourceLimitsDialogOpen(true)
                      : setPurchaseDialogOpen(true)
                  }}
                  variant='destructive'
                >
                  {status === 'resource_limits_reached_for_current_usage'
                    ? <Settings className='h-4 w-4 mr-2' />
                    : <Plus className='h-4 w-4 mr-2' />}
                  {status === 'resource_limits_reached_for_current_usage' ? 'Ajust limits' : 'Add Credits'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
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
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
              <Card className='bg-primary/5 border-primary/20'>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-primary'>
                    <Wallet className='h-5 w-5' />
                    Current Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center justify-between'>
                    <div>
                      <p className='text-4xl font-bold text-foreground mb-1'>
                        {currentBalance?.toLocaleString() || '0'}
                      </p>
                      <p className='text-muted-foreground font-medium'>credits</p>
                    </div>
                    <Button
                      onClick={() => setPurchaseDialogOpen(true)}
                    >
                      <Plus className='h-4 w-4 mr-2' />
                      Add Credits
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className='bg-chart-2/10 border-chart-2/20'>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-chart-2'>
                    <CreditCard className='h-5 w-5' />
                    Current Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className='text-3xl font-bold text-foreground mb-1'>
                      {isPaidPlan ? 'Paid' : 'Free'}
                    </p>
                    <p className='text-muted-foreground font-medium'>
                      {isPaidPlan ? 'Pay-as-you-go pricing' : '1 CPU • 2GB RAM • 10GB storage'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-foreground text-base'>
                    <TrendingUp className='h-4 w-4 text-chart-5' />
                    Monthly Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-2xl font-bold text-foreground mb-1'>
                    {monthlyUsage ? monthlyUsage.toLocaleString() : '0'}
                  </p>
                  <p className='text-muted-foreground text-sm'>credits this month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-foreground text-base'>
                    <Zap className='h-4 w-4 text-chart-1' />
                    Daily Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-2xl font-bold text-foreground mb-1'>
                    {dailyUsage ? dailyUsage.toLocaleString() : '0'}
                  </p>
                  <p className='text-muted-foreground text-sm'>credits per day</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='flex items-center gap-2 text-foreground text-base'>
                    <Database className='h-4 w-4 text-chart-2' />
                    Hourly Usage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className='text-2xl font-bold text-foreground mb-1'>
                    {hourlyUsage ? hourlyUsage.toLocaleString() : '0'}
                  </p>
                  <p className='text-muted-foreground text-sm'>credits per hour</p>
                </CardContent>
              </Card>
            </div>

            {/* Resource Usage */}
            {resources && (
              <Card>
                <CardHeader>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-foreground'>Resource Usage</CardTitle>
                    {isPaidPlan && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => setResourceLimitsDialogOpen(true)}
                      >
                        <Settings className='h-4 w-4 mr-2' />
                        Adjust Limits
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    Monitor your current resource consumption
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='p-2 bg-chart-3/10 rounded-lg'>
                          <Cpu className='h-4 w-4 text-chart-3' />
                        </div>
                        <div>
                          <p className='font-medium text-foreground'>CPU</p>
                          <p className='text-sm text-muted-foreground'>
                            {(parseFloat(resources.cpu.used.replace(/[a-zA-Z]/g, '')) / 1000).toFixed(1)} /{' '}
                            {resources.cpu.limit === 'Infinity'
                              ? '∞'
                              : (parseFloat(resources.cpu.limit.replace(/[a-zA-Z]/g, '')) / 1000).toFixed(1)} cores
                          </p>
                        </div>
                      </div>
                      <Badge variant={resources.cpu.percentage >= 80 ? 'destructive' : 'secondary'}>
                        {resources.cpu.percentage}%
                      </Badge>
                    </div>
                    <Progress
                      value={resources.cpu.percentage}
                      className='h-2'
                    />
                  </div>

                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='p-2 bg-chart-2/10 rounded-lg'>
                          <MemoryStick className='h-4 w-4 text-chart-2' />
                        </div>
                        <div>
                          <p className='font-medium text-foreground'>Memory</p>
                          <p className='text-sm text-muted-foreground'>
                            {(parseFloat(resources.memory.used.replace(/[a-zA-Z]/g, '')) / 1024).toFixed(1)} /{' '}
                            {resources.memory.limit === 'Infinity'
                              ? '∞'
                              : (parseFloat(resources.memory.limit.replace(/[a-zA-Z]/g, '')) / 1024).toFixed(1)} GB
                          </p>
                        </div>
                      </div>
                      <Badge variant={resources.memory.percentage >= 80 ? 'destructive' : 'secondary'}>
                        {resources.memory.percentage}%
                      </Badge>
                    </div>
                    <Progress
                      value={resources.memory.percentage}
                      className='h-2'
                    />
                  </div>

                  <div className='space-y-3'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='p-2 bg-chart-5/10 rounded-lg'>
                          <HardDrive className='h-4 w-4 text-chart-5' />
                        </div>
                        <div>
                          <p className='font-medium text-foreground'>Storage</p>
                          <p className='text-sm text-muted-foreground'>
                            {parseFloat(resources.storage.used.replace(/[a-zA-Z]/g, '')).toFixed(1)} /{' '}
                            {resources.storage.limit === 'Infinity'
                              ? '∞'
                              : parseFloat(resources.storage.limit.replace(/[a-zA-Z]/g, '')).toFixed(1)} GB
                          </p>
                        </div>
                      </div>
                      <Badge variant={resources.storage.percentage >= 90 ? 'destructive' : 'secondary'}>
                        {resources.storage.percentage}%
                      </Badge>
                    </div>
                    <Progress
                      value={resources.storage.percentage}
                      className='h-2'
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className='text-foreground'>Pricing</CardTitle>
                <CardDescription>
                  Transparent pay-as-you-go pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-4'>
                    <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                      <span className='text-foreground font-medium'>CPU per core/hour</span>
                      <Badge variant='outline' className='font-mono'>1 credit</Badge>
                    </div>
                    <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                      <span className='text-foreground font-medium'>Memory per GB/hour</span>
                      <Badge variant='outline' className='font-mono'>1 credit</Badge>
                    </div>
                    <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                      <span className='text-foreground font-medium'>Storage per GB/hour</span>
                      <Badge variant='outline' className='font-mono'>1 credit</Badge>
                    </div>
                  </div>
                  <div className='flex items-center justify-center'>
                    <div className='text-center p-6 bg-primary/5 rounded-xl border border-primary/20'>
                      <p className='text-sm text-muted-foreground mb-2'>Exchange Rate</p>
                      <p className='text-2xl font-bold text-foreground'>1 credit = €0.01</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value='invoices'>
            <Card>
              <DataTableScreen
                title='Billing History'
                description='View and download your invoices'
                icon={Receipt}
                data={invoices}
                columns={columns}
                actions={actions}
                tableTitle='All Invoices'
                tableDescription='Your past invoices and payments'
                mobileCardTitle={(item) => formatDate(item.createdAt)}
                mobileCardStatus={(item) => ({
                  label: item.status,
                  className: getStatusColor(item.status),
                })}
                rowClickable
                onRowClick={(invoice) => {
                  globalThis.open(invoice.downloadUrl, '_blank')
                }}
                mobileCardIcon={() => <Receipt className='h-4 w-4' />}
                searchPlaceholder='Search invoices...'
                searchKeys={['description', 'status']}
                defaultVisibleColumns={['description', 'credits', 'amount', 'status', 'createdAt']}
                emptyMessage='No invoices found. Your purchases will appear here.'
                loading={invoicesLoading || isFetchingNextPage}
                pagination
                page={page}
                onPageChange={(page) => {
                  if (!invoicePages?.pages[page]) {
                    fetchNextPage()
                  }
                  setPage(page)
                }}
                hasNextPage={(!isFetchingNextPage && hasNextPage) || page < (invoicePages?.pages.length || 0) - 1}
                hasPrevPage={page > 0}
              />
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <CreditPurchaseDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} />
        {resources && (
          <ResourceLimitsDialog
            open={resourceLimitsDialogOpen}
            onOpenChange={setResourceLimitsDialogOpen}
            tier={tier}
            currentLimits={{
              cpu: resources.cpu.limit,
              memory: resources.memory.limit,
              storage: resources.storage.limit,
            }}
          />
        )}
      </div>
    </div>
  )
}
