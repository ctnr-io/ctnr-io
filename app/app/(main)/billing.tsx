'use dom'

import React, { useState } from 'react'
import { AlertTriangle, CreditCard, Download, Plus, Receipt, TrendingUp, Wallet } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Card } from 'app/components/shadcn/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'app/components/shadcn/ui/tabs.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'app/components/shadcn/ui/dialog.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'app/components/shadcn/ui/select.tsx'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from 'app/components/shadcn/ui/form.tsx'
import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription } from 'app/components/shadcn/ui/alert.tsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BillingClient } from 'lib/billing/utils.ts'
import { CountryCodes } from 'lib/billing/country_codes.ts'

// Create form schema combining amount with BillingClient
const CreditPurchaseFormSchema = z.object({
  amount: z.string().min(1, 'Please enter an amount').refine((val) => {
    const amount = parseInt(val)
    return !isNaN(amount) && amount > 0 && amount <= 1000000
  }, 'Please enter a valid amount between 1 and 1,000,000 credits'),
}).and(BillingClient)

type CreditPurchaseFormData = z.infer<typeof CreditPurchaseFormSchema>

// Client Information Form Component
function ClientInfoForm({ form, watchedType }: {
  form: any
  watchedType: 'individual' | 'freelance' | 'company'
}) {
  return (
    <div className='space-y-4'>
      <FormField
        control={form.control}
        name='type'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Client Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder='Select client type' />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='individual'>Individual</SelectItem>
                <SelectItem value='freelance'>Freelance</SelectItem>
                <SelectItem value='company'>Company</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {watchedType === 'company'
        ? (
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company Name</FormLabel>
                <FormControl>
                  <Input placeholder='Enter company name' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )
        : (
          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='firstName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter first name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='lastName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter last name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

      {(watchedType === 'freelance' || watchedType === 'company') && (
        <FormField
          control={form.control}
          name='vatNumber'
          render={({ field }) => (
            <FormItem>
              <FormLabel>VAT Number</FormLabel>
              <FormControl>
                <Input placeholder='Enter VAT number' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}

// Billing Address Form Component
function BillingAddressForm({ form }: { form: any }) {
  const [showBillingAddress, setShowBillingAddress] = React.useState(true)

  // Watch for changes in billing address fields to determine if switch should be on
  const billingAddress = form.watch('billingAddress')

  // Update switch state based on whether billing address has any values
  React.useEffect(() => {
    if (billingAddress && Object.values(billingAddress).some((value) => value && value !== '')) {
      setShowBillingAddress(true)
    }
  }, [billingAddress])

  // // Clear billing address when switch is turned off
  // const handleSwitchChange = (checked: boolean) => {
  //   setShowBillingAddress(checked)
  //   if (!checked) {
  //     form.setValue('billingAddress', null)
  //   } else {
  //     // Initialize with empty billing address object when turned on
  //     form.setValue('billingAddress', {
  //       streetAddress: '',
  //       city: '',
  //       postalCode: '',
  //       provinceCode: '',
  //       countryCode: '',
  //     })
  //   }
  // }

  return (
    <div className='border-t pt-4'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h4 className='font-medium'>Billing Address</h4>
          <p className='text-sm text-gray-500'>Add billing address to your invoice</p>
        </div>
        {/* <Switch
          checked={showBillingAddress}
          onCheckedChange={handleSwitchChange}
        /> */}
      </div>

      {showBillingAddress && (
        <div className='space-y-3'>
          <FormField
            control={form.control}
            name='billingAddress.streetAddress'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input placeholder='Enter street address' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='billingAddress.city'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter city' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='billingAddress.postalCode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter postal code' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='billingAddress.provinceCode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Province/State Code (Italian required)</FormLabel>
                  <FormControl>
                    <Input placeholder='' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='billingAddress.countryCode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select country' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(CountryCodes).map(([code, name]) => (
                        <SelectItem key={code} value={code}>
                          {name} ({code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      )}
    </div>
  )
}

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

// Credit Purchase Form Component
function CreditPurchaseForm({ 
  onSubmit, 
  onCancel, 
  isSubmitting,
  clientData,
  clientLoading
}: { 
  onSubmit: (data: CreditPurchaseFormData) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  clientData: any
  clientLoading: boolean
}) {
  const [step, setStep] = useState<'amount' | 'client'>('amount')
  const [isCustomAmount, setIsCustomAmount] = useState(false)

  // Initialize form with default values
  const form = useForm<CreditPurchaseFormData>({
    resolver: zodResolver(CreditPurchaseFormSchema),
    defaultValues: {
      amount: '500',
      type: 'individual',
      firstName: '',
      lastName: '',
      currency: 'EUR',
      locale: 'fr',
      billingAddress: {
        streetAddress: '',
        city: '',
        postalCode: '',
        provinceCode: '',
        countryCode: '',
      },
    },
  })

  // Pre-populate form with existing client data
  React.useEffect(() => {
    if (clientData) {
      const updates: any = {
        type: clientData.type || 'individual',
        currency: clientData.currency || 'EUR',
        locale: clientData.locale || 'FR',
        billingAddress: clientData.billingAddress || null,
      }

      if (clientData.type === 'individual' || clientData.type === 'freelance') {
        updates.firstName = clientData.firstName || ''
        updates.lastName = clientData.lastName || ''
      }

      if (clientData.type === 'company') {
        updates.name = clientData.name || ''
      }

      if (clientData.type === 'freelance' || clientData.type === 'company') {
        updates.vatNumber = clientData.vatNumber || ''
      }

      // Merge with current form values and ensure defaults are preserved
      const currentValues = form.getValues()
      form.reset({
        amount: currentValues.amount || '500',
        ...updates,
      })
    }
  }, [clientData, form])

  const watchedType = form.watch('type')

  const validateStep1 = async () => {
    const result = await form.trigger(['amount'])
    return result
  }

  const handleNext = async () => {
    try {
      const result = await validateStep1()
      if (result) {
        setStep('client')
      }
    } catch (error) {
      console.error('Step 1 validation error:', error)
    }
  }

  const handleBack = () => {
    setStep('amount')
  }

  const handleSubmit = async (data: CreditPurchaseFormData) => {
    await onSubmit(data)
  }

  const handleCancel = () => {
    form.reset()
    setStep('amount')
    onCancel()
  }

  const presetAmounts = [
    { value: '100', label: '100 Credits - €1.00' },
    { value: '500', label: '500 Credits - €5.00' },
    { value: '1000', label: '1000 Credits - €10.00' },
    { value: '5000', label: '5000 Credits - €50.00' },
    { value: 'custom', label: 'Custom Amount' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-4'>
        {step === 'amount' && (
          <div className='space-y-4'>
            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Credit Amount</FormLabel>
                  <Select
                    onValueChange={(amount) => {
                      if (amount === 'custom') {
                        setIsCustomAmount(true)
                      } else {
                        setIsCustomAmount(false)
                        field.onChange(amount)
                      }
                    }}
                    defaultValue={presetAmounts.find((preset) => preset.value === field.value)?.value || 'custom'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select amount' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {presetAmounts.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isCustomAmount && (
              <FormField
                control={form.control}
                name='amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Amount</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        placeholder='Enter credit amount'
                        value={field.value === 'custom' ? '' : field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                    {field.value && field.value !== 'custom' && !form.formState.errors.amount && (
                      <p className='text-sm text-gray-500'>
                        Total: €{(parseInt(field.value) * 0.01).toFixed(2)}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        {step === 'client' && (
          <div className='space-y-4'>
            {clientLoading ? (
              <div className='flex items-center justify-center py-8'>
                <div className='flex items-center gap-3'>
                  <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900'></div>
                  <span className='text-sm text-gray-600'>Loading billing information...</span>
                </div>
              </div>
            ) : (
              <>
                <ClientInfoForm form={form} watchedType={watchedType} />
                <BillingAddressForm form={form} />
              </>
            )}
          </div>
        )}

        <div className='flex justify-end gap-2'>
          <Button variant='outline' type='button' onClick={handleCancel}>
            Cancel
          </Button>
          {step === 'amount'
            ? (
              <Button type='button' onClick={handleNext}>
                Next
              </Button>
            )
            : (
              <>
                <Button type='button' variant='outline' onClick={handleBack}>
                  Back
                </Button>
                <Button
                  type='submit'
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : 'Purchase Credits'}
                </Button>
              </>
            )}
        </div>
      </form>
    </Form>
  )
}

// Credit Purchase Dialog Component
function CreditPurchaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [generalError, setGeneralError] = useState<string>('')
  const trpc = useTRPC()

  const buyCredits = useMutation(trpc.billing.buyCredits.mutationOptions({}))

  // Fetch existing client data at the top level
  const { data: clientData, isLoading: clientLoading } = useQuery({
    ...trpc.billing.getClient.queryOptions({}),
    enabled: open,
  })

  const handleSubmit = async (data: CreditPurchaseFormData) => {
    setGeneralError('')

    const amount = parseInt(data.amount)

    try {
      const clientPayload = {
        type: data.type,
        ...(data.type === 'individual' && {
          firstName: data.firstName!,
          lastName: data.lastName!,
        }),
        ...(data.type === 'freelance' && {
          firstName: data.firstName!,
          lastName: data.lastName!,
          vatNumber: data.vatNumber!,
        }),
        ...(data.type === 'company' && {
          name: data.name!,
          vatNumber: data.vatNumber!,
        }),
        currency: data.currency,
        locale: data.locale,
        billingAddress: data.billingAddress,
      }

      const result = await buyCredits.mutateAsync({
        amount,
        type: 'one-time',
        client: clientPayload,
      })

      // Open payment URL
      globalThis.location.href = result.paymentUrl
      onOpenChange(false)
    } catch (error) {
      console.error('Purchase failed:', error)
      setGeneralError('Purchase failed. Please try again.')
    }
  }

  const handleCancel = () => {
    setGeneralError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogDescription>
            Select the amount of credits you'd like to purchase and provide your billing information.
          </DialogDescription>
        </DialogHeader>

        {generalError && (
          <Alert className='border-red-200 bg-red-50'>
            <AlertTriangle className='h-4 w-4 text-red-600' />
            <AlertDescription className='text-red-700'>
              {generalError}
            </AlertDescription>
          </Alert>
        )}

        <CreditPurchaseForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={buyCredits.isPending}
          clientData={clientData}
          clientLoading={clientLoading}
        />
      </DialogContent>
    </Dialog>
  )
}

export default function BillingScreen() {
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)

  const trpc = useTRPC()

  // Fetch data using tRPC queries
  const { data: usageData, isLoading: usageLoading } = useQuery(trpc.billing.getUsage.queryOptions({}))
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery(
    trpc.billing.getInvoices.queryOptions({ limit: 50, offset: 0 }),
  )

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
  const invoices = invoicesData?.invoices || []
  const dailyUsage = usageData?.costs?.daily ?? 0
  const usage = usageData?.usage
  const status = usageData?.status ?? 'normal'

  // Calculate days remaining for insufficient credits warning
  const daysRemaining = dailyUsage > 0 ? Math.floor(currentBalance / dailyUsage) : 0

  return (
    <div className='w-full py-8'>
      <div className='mb-8 flex items-center justify-between px-6'>
        <div>
          <h1 className='text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent'>
            Billing
          </h1>
          <p className='text-gray-600 mt-2 text-lg'>Manage your credits and billing history</p>
        </div>
      </div>

      {/* Warning Alerts */}
      {(status === 'limit_reached' || status === 'insufficient_credits') && (
        <div className='mb-6 space-y-4 px-4'>
          {status === 'limit_reached' && (
            <div className='border shadow rounded-lg p-4'>
              <div className='flex items-start gap-3'>
                <AlertTriangle className='h-5 w-5 text-red-600 flex-shrink-0 mt-0.5' />
                <div className='flex-1'>
                  <h4 className='font-semibold text-red-700 mb-1'>Resource Limit Reached</h4>
                  <p className='text-sm text-red-700 mb-3'>
                    One or more of your resources (CPU, Memory, or Storage) has reached its limit. Your containers may
                    be throttled or stopped.
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      onClick={() => {
                        setPurchaseDialogOpen(true)
                      }}
                      variant='destructive'
                    >
                      <Plus className='h-3 w-3' />
                      Buy Credits
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status === 'insufficient_credits' && (
            <div className='bg-amber-50 border border-amber-200 rounded-lg p-4'>
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
                      className='bg-amber-600 hover:bg-amber-700 text-white'
                    >
                      Buy Credits
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue='overview' className='space-y-6 px-4'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='overview' className='flex items-center gap-2'>
            <Wallet className='h-4 w-4' />
            Overview
          </TabsTrigger>
          <TabsTrigger value='invoices' className='flex items-center gap-2'>
            <Receipt className='h-4 w-4' />
            Invoices
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value='overview' className='space-y-8'>
          {/* Current Balance & Plan Status */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <Card className='lg:col-span-2 p-8'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 text-sm font-medium'>Current Balance</p>
                  <p className='text-4xl font-bold text-gray-900 mt-1'>{currentBalance?.toLocaleString() || '-'}</p>
                  <p className='text-gray-500 text-sm mt-1'>Credits available</p>
                </div>
                <div className='text-right'>
                  <Button
                    onClick={() => {
                      setPurchaseDialogOpen(true)
                    }}
                    className='bg-gray-900 text-white hover:bg-gray-800'
                    size='sm'
                  >
                    <Plus className='h-3 w-3 mr-2' />
                    Buy Credits
                  </Button>
                </div>
              </div>
            </Card>

            <Card className='p-6'>
              <div>
                <p className='text-gray-600 text-sm font-medium'>Current Plan</p>
                <p className='text-2xl font-bold text-gray-900 mt-1'>{isPaidPlan ? 'Paid' : 'Free'}</p>
                {!isPaidPlan && <p className='text-sm text-gray-500 mt-1'>Pay-as-you-go pricing</p>}
              </div>
            </Card>
          </div>

          {/* Usage Stats */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <Card className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 text-sm font-medium'>This Month</p>
                  <p className='text-3xl font-bold text-gray-900'>{usageData?.costs?.monthly || '-'}</p>
                  <p className='text-gray-500 text-sm'>Total spent credits</p>
                </div>
                <CreditCard className='h-8 w-8 text-gray-400' />
              </div>
            </Card>

            <Card className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-gray-600 text-sm font-medium'>Daily Usage</p>
                  <p className='text-3xl font-bold text-gray-900'>
                    {usageData?.costs?.daily ? `~ ${usageData.costs.daily}` : '-'}
                  </p>
                  <p className='text-gray-500 text-sm'>Credits per day</p>
                </div>
                <TrendingUp className='h-8 w-8 text-gray-400' />
              </div>
            </Card>
          </div>

          {/* How Credits Work */}
          <Card className='p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>How Credits Work</h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='space-y-4'>
                <p className='text-sm text-gray-600'>
                  Purchase credits at €0.01 each and pay only for resources you use. Credits are deducted automatically
                  based on your container usage.
                </p>
                <Alert>
                  <AlertDescription>
                    <strong>Free tier:</strong> Start with 0 credits and get 1 CPU + 2GB RAM to test the platform.
                  </AlertDescription>
                </Alert>
              </div>
              <div className='bg-gray-50 p-4 rounded-lg'>
                <h5 className='font-medium text-gray-900 mb-3'>Pricing per hour</h5>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span>CPU Core</span>
                    <span className='font-mono'>0.1 credits</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Memory (1GB)</span>
                    <span className='font-mono'>0.05 credits</span>
                  </div>
                  <div className='flex justify-between'>
                    <span>Storage (1GB)</span>
                    <span className='font-mono'>0.01 credits</span>
                  </div>
                  <div className='border-t pt-2 mt-3'>
                    <div className='flex justify-between font-medium'>
                      <span>Small container example</span>
                      <span className='font-mono'>~0.25 credits/hour</span>
                    </div>
                    <p className='text-xs text-gray-500 mt-1'>1 CPU + 2GB RAM + 5GB storage</p>
                  </div>
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
