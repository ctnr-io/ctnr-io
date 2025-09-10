'use dom'

import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
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
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, AlertDescription } from 'app/components/shadcn/ui/alert.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'app/components/shadcn/ui/card.tsx'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BillingClient } from 'lib/billing/utils.ts'
import { CountryCodes } from 'lib/billing/country_codes.ts'
import { SearchableSelect } from './searchable-select.tsx'

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
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Billing Information</CardTitle>
        <CardDescription>
          Provide your billing details for the invoice
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
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
      </CardContent>
    </Card>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Billing Address</CardTitle>
        <CardDescription>
          Add billing address to your invoice
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showBillingAddress && (
          <div className='space-y-4'>
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
                name='billingAddress.countryCode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        value={field.value}
                        options={Object.entries(CountryCodes).map(([code, name]) => ({
                          label: `${name} (${code})`,
                          value: code,
                        }))}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch('billingAddress.countryCode') === 'IT' && (
                <FormField
                  control={form.control}
                  name='billingAddress.provinceCode'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province/State Code</FormLabel>
                      <FormControl>
                        <Input placeholder='e.g. MI, RM, TO' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Credit Purchase Form Component
function CreditPurchaseForm({
  onSubmit,
  onCancel,
  isSubmitting,
  clientData,
  clientLoading,
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
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Select Credit Amount</CardTitle>
              <CardDescription>
                Choose how many credits you'd like to purchase
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
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
                        <div className='mt-3 p-3 bg-muted/50 rounded-lg'>
                          <div className='flex justify-between items-center'>
                            <span className='text-sm text-muted-foreground'>Total Cost:</span>
                            <span className='text-sm font-medium'>€{(parseInt(field.value) * 0.01).toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>
        )}

        {step === 'client' && (
          <div className='space-y-4'>
            {clientLoading
              ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='flex items-center gap-3'>
                    <div className='animate-spin rounded-full h-5 w-5 border-b-2 border-primary'></div>
                    <span className='text-sm text-muted-foreground'>Loading billing information...</span>
                  </div>
                </div>
              )
              : (
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
                  {isSubmitting ? 'Processing...' : 'Add Credits'}
                </Button>
              </>
            )}
        </div>
      </form>
    </Form>
  )
}

// Credit Purchase Dialog Component
export function CreditPurchaseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [generalError, setGeneralError] = useState<string>('')
  const trpc = useTRPC()

  const purchaseCredits = useMutation(trpc.billing.purchaseCredits.mutationOptions({}))

  // Fetch existing client data at the top level
  const { data: clientData, isLoading: clientLoading } = useQuery({
    ...trpc.billing.getClient.queryOptions({}),
    enabled: open,
  })

  const handleSubmit = async (data: CreditPurchaseFormData) => {
    setGeneralError('')

    const amount = parseInt(data.amount)

    try {
      const clientPayload: BillingClient = {
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

      const result = await purchaseCredits.mutateAsync({
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
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Add Credits</DialogTitle>
          <DialogDescription>
            Select the amount of credits you'd like to purchase and provide your billing information.
          </DialogDescription>
        </DialogHeader>

        {generalError && (
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription>
              {generalError}
            </AlertDescription>
          </Alert>
        )}

        <CreditPurchaseForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={purchaseCredits.isPending}
          clientData={clientData}
          clientLoading={clientLoading}
        />
      </DialogContent>
    </Dialog>
  )
}
