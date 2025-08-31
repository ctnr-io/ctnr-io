'use dom'

import { Link } from 'expo-router'
import { Coins, Cpu, MemoryStick, HardDrive, Database, ArrowUp, TrendingUp } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { Tier } from '../../../lib/billing/utils.ts'

interface ResourceIndicatorProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  used: string
  limit: string
  percentage: number
}

function ResourceIndicator({ icon: Icon, label, used, limit, percentage }: ResourceIndicatorProps) {
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-50'
    if (percentage >= 80) return 'text-orange-600 bg-orange-50'
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-xs font-medium ${getUsageColor(percentage)}`}>
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

  // Extract data from the API response
  const credits = usageData.credits.balance
  const isFreeTier = usageData.tier.type === 'free'
  const usage = usageData.usage
  const limits = usageData.tier.limits

  // Format display values - API provides data in correct units
  const cpuUsed = (usage.cpu.used / 1000).toFixed(1) // millicores to cores
  const cpuLimit = limits.cpu === Infinity ? '∞' : (limits.cpu / 1000).toFixed(1) // millicores to cores
  const memoryUsed = (usage.memory.used / 1024).toFixed(1) // MB to GB
  const memoryLimit = limits.memory === Infinity ? '∞' : (limits.memory / 1024).toFixed(1) // MB to GB
  
  // Handle both old and new API structure for storage
  const storageUsed = (usage.storage.used || 0 / 1024).toFixed(1) // MB to GB
  const storageLimit = (limits.storage === Infinity ? '∞' : ((limits as any).storage || 0).toFixed(1)) // Already in GB
  
  const formatCredits = (amount: number) => new Intl.NumberFormat('en-US').format(amount)

  // Check if approaching limits (>80%)
  const isApproachingLimits = usage.cpu.percentage > 80 || usage.memory.percentage > 80 || usage.storage.percentage > 80

  const getCreditsColor = (amount: number) => {
    if (amount < 100) return 'text-red-600'
    if (amount < 500) return 'text-orange-600'
    return 'text-green-600'
  }

  const getTierBadgeColor = (tierType: Tier) => {
    switch (tierType) {
      default:
    }
  }

  return (
    <Link href="/(main)/billing" asChild>
      <Button
        variant="ghost"
        className="flex items-center gap-4 px-4 py-2 h-auto hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-gray-600" />
          {isFreeTier ? (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTierBadgeColor(usageData.tier.type)}`}>
                {usageData.tier.type.charAt(0).toUpperCase() + String(usageData.tier.type).slice(1)} Tier
              </span>
              {isApproachingLimits && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full border border-blue-200">
                  <TrendingUp className="h-3 w-3 text-blue-600" />
                  <span className="text-xs text-blue-700 font-medium">Upgrade?</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${getCreditsColor(credits)}`}>
                {formatCredits(credits)} credits
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getTierBadgeColor(usageData.tier.type)}`}>
                {usageData.tier.type.charAt(0).toUpperCase() + usageData.tier.type.slice(1)}
              </span>
              {credits < 500 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 rounded-full border border-orange-200">
                  <ArrowUp className="h-3 w-3 text-orange-600" />
                  <span className="text-xs text-orange-700 font-medium">Low balance</span>
                </div>
              )}
            </div>
          )}
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
