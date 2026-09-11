'use dom'

import { Container, Globe, HardDrive, LayoutGrid, Plus, Rocket, Wallet } from 'lucide-react'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'app/components/shadcn/ui/card.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Alert, AlertDescription } from 'app/components/shadcn/ui/alert.tsx'

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
  onClick,
}: {
  icon: typeof Container
  label: string
  value: string
  isLoading?: boolean
  onClick: () => void
}) {
  return (
    <Card className='cursor-pointer transition-colors hover:bg-muted/50' onClick={onClick}>
      <CardContent className='flex items-center gap-4 pt-6'>
        <div className='rounded-md bg-muted p-2'>
          <Icon className='h-5 w-5 text-muted-foreground' />
        </div>
        <div>
          <div className='text-2xl font-semibold'>{isLoading ? '...' : value}</div>
          <div className='text-sm text-muted-foreground'>{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function OverviewScreen() {
  const router = useRouter()
  const trpc = useTRPC()

  const { data: containers, isLoading: containersLoading } = useQuery(
    trpc.core.listQuery.queryOptions({ output: 'raw', fields: ['basic'] }),
  )
  const { data: volumes, isLoading: volumesLoading } = useQuery(
    trpc.storage.volumes.listQuery.queryOptions({ output: 'raw' }),
  )
  const { data: domains, isLoading: domainsLoading } = useQuery(
    trpc.network.domains.listQuery.queryOptions({ output: 'raw' }),
  )
  const { data: usageData, isLoading: usageLoading } = useQuery(trpc.billing.getUsage.queryOptions({}))

  const credits = usageData ? (usageData.balance.freeCredits ?? 0) + (usageData.balance.paidCredits ?? 0) : undefined

  const containersCount = Array.isArray(containers) ? containers.length : 0
  const volumesCount = Array.isArray(volumes) ? volumes.length : 0
  const domainsCount = Array.isArray(domains) ? domains.length : 0
  const isFirstRun = !containersLoading && !volumesLoading && !domainsLoading &&
    containersCount === 0 && volumesCount === 0 && domainsCount === 0

  return (
    <div className='space-y-6 p-4'>
      <div>
        <h1 className='text-2xl font-semibold'>Overview</h1>
        <p className='text-muted-foreground text-sm'>
          ctnr.io runs your app in a container - no cluster, no YAML to write. Deploy something below, or check on
          what's already running.
        </p>
      </div>

      {isFirstRun
        ? (
          <Alert>
            <Rocket className='h-4 w-4' />
            <AlertDescription>
              You haven't deployed anything yet. ctnr.io turns a container image into a running app with its own URL -
              deploy a preset or your own image below and it'll show up here.
            </AlertDescription>
          </Alert>
        )
        : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              icon={Container}
              label='Containers'
              value={String(containersCount)}
              isLoading={containersLoading}
              onClick={() => router.push('/containers')}
            />
            <StatCard
              icon={HardDrive}
              label='Volumes'
              value={String(volumesCount)}
              isLoading={volumesLoading}
              onClick={() => router.push('/volumes')}
            />
            <StatCard
              icon={Globe}
              label='Domains'
              value={String(domainsCount)}
              isLoading={domainsLoading}
              onClick={() => router.push('/network/domains')}
            />
            <StatCard
              icon={Wallet}
              label='Credits'
              value={credits !== undefined ? credits.toFixed(2) : '0.00'}
              isLoading={usageLoading}
              onClick={() => router.push('/billing')}
            />
          </div>
        )}

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>Deploy a curated preset in one click, or bring your own image.</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-3'>
          <Button onClick={() => router.push('/catalog')}>
            <LayoutGrid className='h-4 w-4' />
            Deploy from Catalog
          </Button>
          <Button variant='outline' onClick={() => router.push('/containers')}>
            <Plus className='h-4 w-4' />
            Create Container
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
