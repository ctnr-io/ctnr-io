'use dom'

import { Link } from 'expo-router'
import { Coins, Plus } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { useQuery } from '@tanstack/react-query'
import { CreditPurchaseDialog } from './billing-purchase-credits-dialog.tsx'
import { useState } from 'react'
import { useSidebar } from '../shadcn/ui/sidebar.tsx'
import { cn } from 'lib/shadcn/utils.ts'

export function CreditsDisplay() {
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false)
  const trpc = useTRPC()
  // Check balance on component mount and periodically
  const { data: usageData, isLoading, error } = useQuery({
    ...trpc.billing.getUsage.queryOptions({}),
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  })

  const sidebar = useSidebar()

  if (isLoading) {
    return null
  }

  if (error || !usageData) {
    return null
  }

  // Extract data from the API response
  const credits = usageData.balance.credits

  return (
    <>
      {/* Desktop View */}
      <div
        className={cn(
          'hidden',
          sidebar.open ? 'lg:flex' : 'md:flex',
          'items-center gap-2',
        )}
      >
        <Link href='/(main)/billing' asChild>
          <Button variant='ghost' className='cursor-pointer'>
            <Coins className='h-4 w-4 text-muted-foreground' />
            <span className='text-sm font-semibold text-foreground'>
              {Number(credits.toFixed()).toLocaleString()}
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
          <span className='hidden md:inline'>
            Add Credits
          </span>
        </Button>
      </div>
      {/* Mobile view */}
      <div
        className={cn(
          sidebar.open ? 'lg:hidden' : 'md:hidden',
          'items-center gap-2',
        )}
      >
        <Button variant='outline' className='cursor-pointer' onClick={() => setIsPurchaseDialogOpen(true)}>
          <Plus className='h-4 w-4 text-muted-foreground' />
          <Coins className='h-4 w-4 text-muted-foreground' />
          <span className='hidden xs:inline text-sm font-semibold text-foreground text-ellipsis'>
            {Number(credits.toFixed()).toLocaleString()}
          </span>
        </Button>
      </div>
      <CreditPurchaseDialog
        open={isPurchaseDialogOpen}
        onOpenChange={setIsPurchaseDialogOpen}
      />
    </>
  )
}
