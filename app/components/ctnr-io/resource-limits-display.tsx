'use dom'

import { Coins, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadcn/ui/tooltip.tsx'
import { useState } from 'react'
import { ResourceLimitsDialog } from './resource-limits-dialog.tsx'
import { useSidebar } from '../shadcn/ui/sidebar.tsx'
import { cn } from 'lib/shadcn/utils.ts'

interface ResourceIndicatorProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  used: string
  limit: string
  percentage: number
}

function ResourceIndicator({ icon: Icon, label, used, limit, percentage }: ResourceIndicatorProps) {
  const sidebar = useSidebar()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className='flex gap-2 *:text-xs justify-center'>
          <Icon className={percentage >= 100 && used !== '0.0' ? 'text-destructive animate-pulse' : ''} />
          <span className={cn('items-baseline', 'gap-1', 'hidden', sidebar.open ? 'lg:flex' : 'sm:flex')}>
            <span className={percentage >= 100 && used !== '0.0' ? 'text-destructive' : ''}>{used}</span>
            <span>/</span>
            <span>{limit}</span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function ResourceLimitsDisplay() {
  const [isResourceLimitsDialogOpen, setIsResourceLimitsDialogOpen] = useState(false)
  const trpc = useTRPC()
  // Check balance on component mount and periodically
  const { data: usageData, isLoading, error } = useQuery({
    ...trpc.billing.getUsage.queryOptions({}),
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
  const tier = usageData.tier
  const resources = usageData.resources

  // Parse API values that come with units (e.g., "1000m", "2048M", "10G")
  const parseValue = (value: string): number => {
    if (!value) return 0
    const numStr = value.replace(/[a-zA-Z]/g, '')
    return parseFloat(numStr) || 0
  }

  const cpuUsedNum = parseValue(resources.cpu.used)
  const cpuLimitNum = resources.cpu.limit === 'Infinity' ? Infinity : parseValue(resources.cpu.limit)
  const memoryUsedNum = parseValue(resources.memory.used)
  const memoryLimitNum = resources.memory.limit === 'Infinity' ? Infinity : parseValue(resources.memory.limit)
  const storageUsedNum = parseValue(resources.storage.used)
  const storageLimitNum = resources.storage.limit === 'Infinity' ? Infinity : parseValue(resources.storage.limit)

  // Format display values
  const cpuUsed = (cpuUsedNum / 1000).toFixed(1) // millicores to cores
  const cpuLimit = cpuLimitNum === Infinity ? '∞' : (cpuLimitNum / 1000).toFixed(1) // millicores to cores
  const memoryUsed = (memoryUsedNum / 1024).toFixed(1) // MB to GB
  const memoryLimit = memoryLimitNum === Infinity ? '∞' : (memoryLimitNum / 1024).toFixed(1) // MB to GB
  const storageUsed = storageUsedNum.toFixed(1) // Already in GB
  const storageLimit = storageLimitNum === Infinity ? '∞' : storageLimitNum.toFixed(1) // Already in GB

  return (
    <div className='flex flex-1 justify-between items-center gap-4'>
      {
        /* {(status === 'insufficient_credits_for_current_usage' ||
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
      )} */
      }
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
          percentage={resources.cpu.percentage}
        />
        <ResourceIndicator
          icon={MemoryStick}
          label='Memory (GB)'
          used={memoryUsed}
          limit={memoryLimit}
          percentage={resources.memory.percentage}
        />
        <ResourceIndicator
          icon={HardDrive}
          label='Storage (GB)'
          used={storageUsed}
          limit={storageLimit}
          percentage={resources.storage.percentage}
        />
      </Button>
      {resources && (
        <ResourceLimitsDialog
          open={isResourceLimitsDialogOpen}
          onOpenChange={setIsResourceLimitsDialogOpen}
          tier={tier}
          currentLimits={{
            cpu: resources.cpu.limit,
            memory: resources.memory.limit,
            storage: resources.storage.limit,
          }}
        />
      )}
    </div>
  )
}
