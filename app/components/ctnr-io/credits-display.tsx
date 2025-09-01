'use dom'

import { Link } from 'expo-router'
import { Coins, Cpu, MemoryStick, HardDrive, Plus, AlertTriangle } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'

interface ResourceIndicatorProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  used: string
  limit: string
  percentage: number
}

function ResourceIndicator({ icon: Icon, label, used, limit, percentage }: ResourceIndicatorProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-gray-900">
            {used}/{limit}
          </span>
          <span className="text-xs text-gray-500 truncate">{label}</span>
        </div>
      </div>
    </div>
  )
}

export default function CreditsDisplay() {
  const trpc = useTRPC()
  const { data: usageData, isLoading, error } = useQuery(trpc.billing.getUsage.queryOptions({}))
  
  // Check balance on component mount and periodically
  const { data: balanceCheck } = useQuery({
    ...trpc.billing.checkBalance.queryOptions({}),
    refetchInterval: 30000, // Check every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100">
        <Coins className="h-4 w-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Loading usage...</span>
      </div>
    )
  }

  if (error || !usageData) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-50 to-red-100">
        <Coins className="h-4 w-4 text-red-400" />
        <span className="text-sm text-red-600">Failed to load</span>
      </div>
    )
  }

  // Extract data from the API response - use updated balance if available
  const credits = balanceCheck?.credits.balance ?? usageData.credits.balance
  const usage = usageData.usage
  const baseLimits = usageData.tier.limits

  // Apply credit-based limits: 0 credits = 1 CPU, 2GB max
  const limits = credits === 0 ? {
    cpu: 1000, // 1 CPU in millicores
    memory: 2048, // 2GB in MB
    storage: baseLimits.storage // Keep storage limit as is
  } : baseLimits

  // Format display values - API provides data in correct units
  const cpuUsed = (usage.cpu.used / 1000).toFixed(1) // millicores to cores
  const cpuLimit = limits.cpu === Infinity ? '∞' : (limits.cpu / 1000).toFixed(1) // millicores to cores
  const memoryUsed = (usage.memory.used / 1024).toFixed(1) // MB to GB
  const memoryLimit = limits.memory === Infinity ? '∞' : (limits.memory / 1024).toFixed(1) // MB to GB
  const storageUsed = (usage.storage.used / 1024).toFixed(1) // MB to GB
  const storageLimit = limits.storage === Infinity ? '∞' : (limits.storage / 1024).toFixed(1) // MB to GB
  
  const formatCredits = (amount: number) => new Intl.NumberFormat('en-US').format(amount)

  // Check if any resource limit is reached or surpassed
  const isLimitReached = usage.cpu.percentage >= 100 || usage.memory.percentage >= 100 || usage.storage.percentage >= 100

  return (
    <Link href="/(main)/billing" asChild>
      <Button
        variant="ghost"
        className="flex items-center gap-4 px-4 py-2 h-auto hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-gray-600" />
          <div className="flex items-center gap-2">
            {credits > 0 ? (
              <span className="text-sm font-semibold text-gray-900">
                {formatCredits(usageData.costs.daily)} / {formatCredits(credits)}
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium rounded-full border bg-gray-100 text-gray-700 border-gray-200">
                Free
              </span>
            )}
            {isLimitReached && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-full border border-red-200">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Limit reached</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ResourceIndicator
            icon={Cpu}
            label="CPU"
            used={cpuUsed}
            limit={cpuLimit}
            percentage={usage.cpu.percentage}
          />
          <ResourceIndicator
            icon={MemoryStick}
            label="GB"
            used={memoryUsed}
            limit={memoryLimit}
            percentage={usage.memory.percentage}
          />
          <ResourceIndicator
            icon={HardDrive}
            label="GB"
            used={storageUsed}
            limit={storageLimit}
            percentage={usage.storage.percentage}
          />

        </div>
      </Button>
    </Link>
  )
}
