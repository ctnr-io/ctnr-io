'use dom'

import { Link } from 'expo-router'
import { AlertTriangle, Coins, Cpu, HardDrive, MemoryStick, Plus } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '../shadcn/ui/badge.tsx'
import { Tooltip, TooltipContent, TooltipTrigger } from '../shadcn/ui/tooltip.tsx'

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
        <Badge
          title={label}
          variant={percentage >= 100 ? 'destructive' : 'secondary'}
        >
          <Icon />
          {used}/{limit}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export default function CreditsDisplay() {
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
      <div className='flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100'>
        <Coins className='h-4 w-4 text-gray-400 animate-pulse' />
        <span className='text-sm text-gray-500'>Loading usage...</span>
      </div>
    )
  }

  if (error || !usageData) {
    return (
      <div className='flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-50 to-red-100'>
        <Coins className='h-4 w-4 text-red-400' />
        <span className='text-sm text-red-600'>Failed to load</span>
      </div>
    )
  }

  // Extract data from the API response
  const credits = usageData?.credits?.balance ?? 0
  const usage = usageData?.usage
  const status = usageData?.status ?? 'normal'
  const limits = usageData?.tier?.limits ?? {
    cpu: 1000, // 1 CPU in millicores
    memory: 2048, // 2GB in MB
    storage: 10240, // 10GB in MB
  }

  // Format display values - API provides data in correct units
  const cpuUsed = (usage.cpu.used / 1000).toFixed(1) // millicores to cores
  const cpuLimit = limits.cpu === Infinity ? '∞' : (limits.cpu / 1000).toFixed(1) // millicores to cores
  const memoryUsed = (usage.memory.used / 1024).toFixed(1) // MB to GB
  const memoryLimit = limits.memory === Infinity ? '∞' : (limits.memory / 1024).toFixed(1) // MB to GB
  const storageUsed = (usage.storage.used / 1024).toFixed(1) // MB to GB
  const storageLimit = limits.storage === Infinity ? '∞' : (limits.storage / 1024).toFixed(1) // MB to GB

  const formatCredits = (amount: number) => new Intl.NumberFormat('en-US').format(amount)

  return (
    <div className='flex items-center gap-4 px-4'>
      <div className='flex items-center gap-2 py-2'>
        {status === 'insufficient_credits' || status === 'limit_reached' && (
              <Link href='/(main)/billing' asChild>
                <Button
                  variant='link'
                  size='sm'
                  className='cursor-pointer text-amber-700 '
                >
                  <AlertTriangle className='h-3 w-3 text-red-600' />
                  {status === 'limit_reached'
                    ? 'Limit reached'
                    : status === 'insufficient_credits'
                    ? 'Low balance'
                    : null}
                </Button>
              </Link>
            )}
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
      </div>
      <div className='flex items-center gap-2'>
        <div className='flex items-center gap-2'>
          <Link href='/(main)/billing' asChild>
            <Button variant='ghost' className='cursor-pointer hover:bg-gray-50'>
              <Coins className='h-4 w-4 text-gray-600' />
              <span className='text-sm font-semibold text-gray-900'>
                {formatCredits(credits)}
              </span>
            </Button>
          </Link>
          <Link href='/(main)/billing' asChild>
            <Button variant='outline' size='sm' className='cursor-pointer shadow-sm active:shadow-sm '>
              <Plus className='h-4 w-4 text-gray-600' />
              Buy credits
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
