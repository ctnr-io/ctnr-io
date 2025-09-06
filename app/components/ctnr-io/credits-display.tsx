'use dom'

import { Link } from 'expo-router'
import { Coins, Plus } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { CreditPurchaseDialog } from './billing-purchase-credits-dialog.tsx'
import { useState } from 'react'

export function CreditsDisplay() {
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
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
  const credits = usageData.credits.balance ?? 0


  return (
    <div className='flex items-center gap-2'>
      <Link href='/(main)/billing' asChild>
        <Button variant='ghost' className='cursor-pointer'>
          <Coins className='h-4 w-4 text-muted-foreground' />
          <span className='text-sm font-semibold text-foreground'>
            {credits.toLocaleString()}
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
      <CreditPurchaseDialog
        open={isPurchaseDialogOpen}
        onOpenChange={setIsPurchaseDialogOpen}
      />
    </div>
  )
}
