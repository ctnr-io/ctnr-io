'use dom'

import { Link } from 'expo-router'
import { AlertTriangle, Coins, Cpu, HardDrive, MemoryStick, Plus } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '../shadcn/ui/badge.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadcn/ui/tooltip.tsx'
import { CreditPurchaseDialog } from './billing-purchase-credits-dialog.tsx'
import { useState } from 'react'
import { ResourceLimitsDialog } from './resource-limits-dialog.tsx'

interface ResourceIndicatorProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  used: string
  limit: string
  percentage: number
}

function ResourceIndicator({ icon: Icon, label, used, limit, percentage }: ResourceIndicatorProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className='flex items-center gap-1 *:text-xs text-xs'>
          <Icon className={percentage >= 100 && used !== '0.0' ? 'text-destructive animate-pulse' : ''} />
          <span className={percentage >= 100 && used !== '0.0' ? 'text-destructive' : ''}>{used}</span>
          <span>/{limit}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function CreditsDisplay() {
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const [isResourceLimitsDialogOpen, setIsResourceLimitsDialogOpen] = useState(false)
  const trpc = useTRPC()
  // Check balance on component mount and periodically
  const { data: usageData, isLoading, error } = useQuery({
    ...trpc.billing.getUsage.queryOptions({}),
    refetchInterval: 30000, // Check every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })

  if (isLoading) {
    return (
      <div className='flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg'>
        <Coins className='h-4 w-4 text-muted-foreground animate-pulse' />
        <span className='text-sm text-muted-foreground'>Loading usage...</span>
      </div>
    )
  }

  if (error || !usageData) {
    return (
      <div className='flex items-center gap-2 px-4 py-2 bg-destructive/10 rounded-lg'>
        <Coins className='h-4 w-4 text-destructive' />
        <span className='text-sm text-destructive'>Failed to load</span>
      </div>
    )
  }

  // Extract data from the API response
  const credits = usageData.credits.balance ?? 0
  const usage = usageData.usage
  const status = usageData.status

  // Parse API values that come with units (e.g., "1000m", "2048M", "10G")
  const parseValue = (value: string): number => {
    if (!value) return 0
    const numStr = value.replace(/[a-zA-Z]/g, '')
    return parseFloat(numStr) || 0
  }

  const cpuUsedNum = parseValue(usage.cpu.used)
  const cpuLimitNum = usage.cpu.limit === 'Infinity' ? Infinity : parseValue(usage.cpu.limit)
  const memoryUsedNum = parseValue(usage.memory.used)
  const memoryLimitNum = usage.memory.limit === 'Infinity' ? Infinity : parseValue(usage.memory.limit)
  const storageUsedNum = parseValue(usage.storage.used)
  const storageLimitNum = usage.storage.limit === 'Infinity' ? Infinity : parseValue(usage.storage.limit)

  // Format display values
  const cpuUsed = (cpuUsedNum / 1000).toFixed(1) // millicores to cores
  const cpuLimit = cpuLimitNum === Infinity ? '∞' : (cpuLimitNum / 1000).toFixed(1) // millicores to cores
  const memoryUsed = (memoryUsedNum / 1024).toFixed(1) // MB to GB
  const memoryLimit = memoryLimitNum === Infinity ? '∞' : (memoryLimitNum / 1024).toFixed(1) // MB to GB
  const storageUsed = storageUsedNum.toFixed(1) // Already in GB
  const storageLimit = storageLimitNum === Infinity ? '∞' : storageLimitNum.toFixed(1) // Already in GB

  const formatCredits = (amount: number) => new Intl.NumberFormat('en-US').format(amount)

  return (
    <div className='flex flex-1 justify-between items-center gap-4 px-4'>
      {/* {(status === 'insufficient_credits_for_current_usage' ||
        status === 'resource_limits_reached_for_current_usage') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle className='h-4 w-4 text-destructive' />
          </TooltipTrigger>
          <TooltipContent>
            {status === 'resource_limits_reached_for_current_usage'
              ? 'Limit reached'
              : status === 'insufficient_credits_for_current_usage'
              ? 'Insufficient Credits'
              : null}
          </TooltipContent>
        </Tooltip>
      )} */}
      <Button
        className='flex items-center gap-4 cursor-pointer'
        variant='secondary'
        onClick={() => setIsResourceLimitsDialogOpen(true)}
      >
        <ResourceIndicator
          icon={Cpu}
          label='Processor (vCPU)'
          used={cpuUsed}
          limit={cpuLimit}
          percentage={usage.cpu.percentage}
        />
        <ResourceIndicator
          icon={MemoryStick}
          label='Memory (GB)'
          used={memoryUsed}
          limit={memoryLimit}
          percentage={usage.memory.percentage}
        />
        <ResourceIndicator
          icon={HardDrive}
          label='Storage (GB)'
          used={storageUsed}
          limit={storageLimit}
          percentage={usage.storage.percentage}
        />
      </Button>
      <div className='flex items-center gap-2'>
        <div className='flex items-center gap-2'>
          <Link href='/(main)/billing' asChild>
            <Button variant='ghost' className='cursor-pointer'>
              <Coins className='h-4 w-4 text-muted-foreground' />
              <span className='text-sm font-semibold text-foreground'>
                {formatCredits(credits)}
              </span>
            </Button>
          </Link>
          <Button
            variant='outline'
            size='sm'
            className='cursor-pointer'
            onClick={() => setIsPurchaseDialogOpen(true)}
          >
            <Plus className='h-4 w-4 text-muted-foreground' />
            Add Credits
          </Button>
        </div>
      </div>

      <CreditPurchaseDialog
        open={isPurchaseDialogOpen}
        onOpenChange={setIsPurchaseDialogOpen}
      />
      {usage && (
        <ResourceLimitsDialog
          open={isResourceLimitsDialogOpen}
          onOpenChange={setIsResourceLimitsDialogOpen}
          currentLimits={{
            cpu: usage.cpu.limit,
            memory: usage.memory.limit,
            storage: usage.storage.limit,
          }}
        />
      )}
    </div>
  )
}
