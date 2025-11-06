'use dom'

import React, { useState, useTransition } from 'react'
import { AlertTriangle, Lock } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from 'app/components/shadcn/ui/dialog.tsx'
import { Slider } from 'app/components/shadcn/ui/slider.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription } from 'app/components/shadcn/ui/alert.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'app/components/shadcn/ui/card.tsx'
import { ResourceLimits } from 'lib/billing/utils.ts'
import { calculateTotalCostWithFreeTier, DEFAULT_RATES } from 'lib/billing/cost.ts'
import { CreditPurchaseDialog } from './billing-purchase-credits-dialog.tsx'

interface ResourceLimitsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tier: 'free' | 'paid'
  currentLimits: {
    cpu: string
    memory: string
    storage: string
  }
}

export function ResourceLimitsDialog({ open, onOpenChange, tier, currentLimits }: ResourceLimitsDialogProps) {
  const [generalError, setGeneralError] = useState<string>('')
  const [creditPurchaseOpen, setCreditPurchaseOpen] = useState(false)
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const setLimits = useMutation(trpc.billing.setLimits.mutationOptions({}))

  // Convert current limits to slider values using logarithmic scaling
  const getInitialCpuSlider = () => {
    const cpu = ResourceLimits.cpu.fromString(currentLimits.cpu)
    if (cpu === Infinity) return ResourceLimits.cpu.toSlider(1000)
    const clampedValue = Math.max(ResourceLimits.cpu.min, Math.min(ResourceLimits.cpu.max, cpu))
    return ResourceLimits.cpu.toSlider(clampedValue)
  }

  const getInitialMemorySlider = () => {
    const memory = ResourceLimits.memory.fromString(currentLimits.memory)
    if (memory === Infinity) return ResourceLimits.memory.toSlider(2)
    const clampedValue = Math.max(ResourceLimits.memory.min, Math.min(ResourceLimits.memory.max, memory))
    return ResourceLimits.memory.toSlider(clampedValue)
  }

  const getInitialStorageSlider = () => {
    const storage = ResourceLimits.storage.fromString(currentLimits.storage)
    if (storage === Infinity) return ResourceLimits.storage.toSlider(1)
    const clampedValue = Math.max(ResourceLimits.storage.min, Math.min(ResourceLimits.storage.max, storage))
    return ResourceLimits.storage.toSlider(clampedValue)
  }

  // State for slider values (0-100 range for logarithmic sliders)
  const [cpuSlider, setCpuSlider] = useState([getInitialCpuSlider()])
  const [memorySlider, setMemorySlider] = useState([getInitialMemorySlider()])
  const [storageSlider, setStorageSlider] = useState([getInitialStorageSlider()])

  // Convert slider values back to actual resource values
  const cpuValue = ResourceLimits.cpu.fromSlider(cpuSlider[0])
  const memoryValue = ResourceLimits.memory.fromSlider(memorySlider[0])
  const storageValue = ResourceLimits.storage.fromSlider(storageSlider[0])

  // Update slider values when dialog opens or currentLimits change
  React.useEffect(() => {
    if (open) {
      setCpuSlider([getInitialCpuSlider()])
      setMemorySlider([getInitialMemorySlider()])
      setStorageSlider([getInitialStorageSlider()])
    }
  }, [open, currentLimits])

  // Calculate estimated costs based on current slider values
  const calculateEstimatedCost = () => {
    return calculateTotalCostWithFreeTier(
      String(cpuValue), // CPU in cores
      memoryValue + 'G', // Memory in GB
      storageValue + 'G', // Storage in GB
    )
  }

  const estimatedCost = calculateEstimatedCost()

  const [isSubmitPending, startSubmitTransition] = useTransition()

  const handleSubmit = () =>
    startSubmitTransition(async () => {
      setGeneralError('')
      try {
        await setLimits.mutateAsync({
          cpu: ResourceLimits.cpu.format(cpuValue),
          memory: ResourceLimits.memory.format(memoryValue),
          storage: ResourceLimits.storage.format(storageValue),
        })

        // Invalidate and refetch usage data
        await queryClient.invalidateQueries({
          queryKey: trpc.billing.getUsage.queryKey({}),
        })

        onOpenChange(false)
      } catch (error) {
        console.error('Failed to update limits:', error)
        setGeneralError('Failed to update resource limits. Please try again.')
      }
    })

  const handleCancel = () => {
    setGeneralError('')
    setCpuSlider([getInitialCpuSlider()])
    setMemorySlider([getInitialMemorySlider()])
    setStorageSlider([getInitialStorageSlider()])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Adjust Resource Limits</DialogTitle>
          <DialogDescription>
            Use the sliders to adjust your resource limits. Changes take effect immediately.
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

        {tier === 'free' && (
          <Alert>
            <Lock className='h-4 w-4' />
            <AlertDescription>
              Resource limit adjustments are only available for paid tier users. You're currently on the free tier with
              fixed limits: 1 CPU core, 2 GB memory, and 1 GB storage.
            </AlertDescription>
          </Alert>
        )}

        <div className='space-y-4'>
          {/* Resource Limits Card */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Resource Configuration</CardTitle>
              <CardDescription>
                Adjust your container resource limits using the sliders below
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* CPU Slider */}
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                    CPU Limit
                    {tier === 'free' && <Lock className='h-3 w-3 text-muted-foreground' />}
                  </label>
                  <span className='text-sm font-semibold text-primary'>
                    {ResourceLimits.cpu.display(cpuValue)}
                  </span>
                </div>
                <Slider
                  value={cpuSlider}
                  onValueChange={tier === 'free' ? undefined : setCpuSlider}
                  min={0}
                  max={100}
                  step={ResourceLimits.cpu.step}
                  className={`w-full ${tier === 'free' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={tier === 'free'}
                />
                <p className='text-xs text-muted-foreground'>
                  {tier === 'free'
                    ? 'Fixed at 1 CPU core for free tier users'
                    : `Range: ${ResourceLimits.cpu.display(ResourceLimits.cpu.min)} - ${
                      ResourceLimits.cpu.display(ResourceLimits.cpu.max)
                    }`}
                </p>
              </div>

              {/* Memory Slider */}
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                    Memory Limit
                    {tier === 'free' && <Lock className='h-3 w-3 text-muted-foreground' />}
                  </label>
                  <span className='text-sm font-semibold text-primary'>
                    {ResourceLimits.memory.display(memoryValue)}
                  </span>
                </div>
                <Slider
                  value={memorySlider}
                  onValueChange={tier === 'free' ? undefined : setMemorySlider}
                  min={0}
                  max={100}
                  step={ResourceLimits.memory.step}
                  className={`w-full ${tier === 'free' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={tier === 'free'}
                />
                <p className='text-xs text-muted-foreground'>
                  {tier === 'free'
                    ? 'Fixed at 2 GB memory for free tier users'
                    : `Range: ${ResourceLimits.memory.display(ResourceLimits.memory.min)} - ${
                      ResourceLimits.memory.display(ResourceLimits.memory.max)
                    }`}
                </p>
              </div>

              {/* Storage Slider */}
              <div className='space-y-3'>
                <div className='flex justify-between items-center'>
                  <label className='text-sm font-medium text-foreground flex items-center gap-2'>
                    Storage Limit
                    {tier === 'free' && <Lock className='h-3 w-3 text-muted-foreground' />}
                  </label>
                  <span className='text-sm font-semibold text-primary'>
                    {ResourceLimits.storage.display(storageValue)}
                  </span>
                </div>
                <Slider
                  value={storageSlider}
                  onValueChange={tier === 'free' ? undefined : setStorageSlider}
                  min={0}
                  max={100}
                  step={ResourceLimits.storage.step}
                  className={`w-full ${tier === 'free' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={tier === 'free'}
                />
                <p className='text-xs text-muted-foreground'>
                  {tier === 'free'
                    ? 'Fixed at 1 GB storage for free tier users'
                    : `Range: ${ResourceLimits.storage.display(ResourceLimits.storage.min)} - ${
                      ResourceLimits.storage.display(ResourceLimits.storage.max)
                    }`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cost Limit Estimation Card */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Cost Limit Estimation</CardTitle>
              <CardDescription>
                Maximum estimated costs based on your current resource limit configuration. FYI - you only pay for what
                you use.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='p-3 bg-muted/50 rounded-lg'>
                <div className='text-xs text-muted-foreground space-y-1'>
                  <div className='font-medium text-foreground mb-2'>Free tier: 1 CPU, 2 GB memory, 1 GB storage</div>
                  <div>
                    CPU: {ResourceLimits.cpu.display(cpuValue)}{' '}
                    × €{(DEFAULT_RATES.cpuPerHour * 0.01).toFixed(3)}/core/hour
                  </div>
                  <div>
                    Memory: {ResourceLimits.memory.display(memoryValue)}{' '}
                    × €{(DEFAULT_RATES.memoryPerHour * 0.01).toFixed(2)}/GB/hour
                  </div>
                  <div>
                    Storage: {ResourceLimits.storage.display(storageValue)}{' '}
                    × €{(DEFAULT_RATES.storagePerHour * 0.01).toFixed(3)}/GB/hour
                  </div>
                </div>
              </div>

              <div className='space-y-2'>
                <div className='flex justify-between items-center py-2 border-b border-border/50'>
                  <span className='text-sm text-muted-foreground'>Hourly:</span>
                  <span className='text-sm font-medium'>
                    {estimatedCost.hourly.toLocaleString()} credits ({(estimatedCost.hourly * 0.01).toFixed(2)} €)
                  </span>
                </div>
                <div className='flex justify-between items-center py-2 border-b border-border/50'>
                  <span className='text-sm text-muted-foreground'>Daily:</span>
                  <span className='text-sm font-medium'>
                    {estimatedCost.daily.toLocaleString()} credits ({(estimatedCost.daily * 0.01).toFixed(2)} €)
                  </span>
                </div>
                <div className='flex justify-between items-center py-2'>
                  <span className='text-sm text-muted-foreground'>Monthly:</span>
                  <span className='text-sm font-semibold text-primary'>
                    {estimatedCost.monthly.toLocaleString()} credits ({(estimatedCost.monthly * 0.01).toFixed(2)} €)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='flex justify-end gap-2 pt-4'>
          <Button variant='outline' type='button' onClick={handleCancel}>
            {tier === 'free' ? 'Close' : 'Cancel'}
          </Button>
          {tier === 'free'
            ? (
              <Button
                onClick={() => {
                  onOpenChange(false)
                  setCreditPurchaseOpen(true)
                }}
              >
                Upgrade to Paid Plan
              </Button>
            )
            : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitPending}
              >
                {isSubmitPending ? 'Updating...' : 'Update Limits'}
              </Button>
            )}
        </div>
      </DialogContent>

      <CreditPurchaseDialog
        open={creditPurchaseOpen}
        onOpenChange={setCreditPurchaseOpen}
      />
    </Dialog>
  )
}
