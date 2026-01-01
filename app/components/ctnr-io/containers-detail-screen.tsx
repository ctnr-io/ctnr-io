'use dom'

import { ContainerImageIcon } from 'app/components/ctnr-io/container-image-icon.tsx'
import { ContainerLogs } from 'app/components/ctnr-io/container-logs.tsx'
import { DataDetailsScreen } from 'app/components/ctnr-io/data-details-screen.tsx'
import { Copy, FileText, Info, Play, RotateCcw, Settings, Square, Trash2 } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { useRouter } from 'expo-router'
import { ActivityIndicator } from 'react-native'
import { useEffect } from 'react'
import ResponsiveDialog from './responsive-dialog.tsx'
import { useSidebar } from '../shadcn/ui/sidebar.tsx'
import { cn } from 'lib/shadcn/utils.ts'

function getStatusColor(status: string) {
  switch (status) {
    case 'running':
      return 'text-chart-2 bg-chart-2/10'
    case 'stopped':
      return 'text-destructive bg-destructive/10'
    case 'restarting':
      return 'text-chart-4 bg-chart-4/10'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export type ContainerData = {
  name: string
  image: any
  status: string
  createdAt: Date
  ports: {
    name?: string
    number: number
    protocol: string
  }[]
  cpu: string
  memory: string
  storage: string
  replicas: {
    max: number
    min: number
    current: number
    instances: {
      name: string
      status: string
      createdAt: Date
      cpu: string
      memory: string
    }[]
  }
  routes: string[]
  clusters: string[]
  restartPolicy: string
  command: string[]
  workingDir: string
  environment: Record<string, string>
  volumes: string[]
}

export function ContainersDetailScreen(props: {
  data: ContainerData
  isLoading: boolean
}) {
  const { isLoading } = props

  // Create skeleton data for loading state
  const data: ContainerData | null = isLoading ? null : props.data

  const queryClient = useQueryClient()

  const trpc = useTRPC()

  const router = useRouter()

  const sidebar = useSidebar()

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.core.listQuery.queryKey(),
    })
    queryClient.invalidateQueries({
      queryKey: trpc.billing.getUsage.queryKey(),
    })
  }

  const startMutation = useMutation(
    trpc.core.startMutation.mutationOptions({
      onSuccess: invalidate,
    }),
  )
  const stopMutation = useMutation(
    trpc.core.stopMutation.mutationOptions({
      onSuccess: invalidate,
    }),
  )
  const restartMutation = useMutation(
    trpc.core.restartMutation.mutationOptions({
      onSuccess: invalidate,
    }),
  )
  const removeMutation = useMutation(
    trpc.core.removeMutation.mutationOptions({
      onSuccess: () => {
        router.replace('/(main)/containers')
        return invalidate()
      },
    }),
  )

  const isPending = data?.status === 'restarting' ||
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending ||
    removeMutation.isPending

  useEffect(() => {
    if (!isPending) return
    const interval = setInterval(() => {
      invalidate()
    }, 3000)
    return () => clearInterval(interval)
  }, [isPending])

  if (isLoading || !data) {
    return (
      <DataDetailsScreen
        title='Container Details'
        subtitle='Loading container information...'
        tabs={[]}
        isLoading
        loadingText='Loading container details...'
      />
    )
  }

  // Build the header actions
  const headerActions = (
    <>
      {isPending && <ActivityIndicator color='gray' />}
      <Button
        variant={data.status !== 'running' ? 'outline' : 'secondary'}
        size='sm'
        onClick={() => startMutation.mutate({ name: data.name })}
        disabled={isPending || data.status === 'running'}
      >
        <Play className='h-4 w-4' />
        <span className={cn('hidden', sidebar.open ? 'lg:inline' : 'sm:inline')}>
          Start
        </span>
      </Button>
      <Button
        variant={data.status !== 'stopped' ? 'outline' : 'secondary'}
        size='sm'
        onClick={() => stopMutation.mutate({ name: data.name })}
        disabled={isPending || data.status === 'stopped'}
      >
        <Square className='h-4 w-4' />
        <span className={cn('hidden', sidebar.open ? 'lg:inline' : 'sm:inline')}>
          Stop
        </span>
      </Button>
      <Button
        variant='outline'
        size='sm'
        onClick={() => restartMutation.mutate({ name: data.name })}
        disabled={isPending || data.status !== 'running'}
      >
        <RotateCcw className='h-4 w-4' />
        <span className={cn('hidden', sidebar.open ? 'lg:inline' : 'sm:inline')}>
          Restart
        </span>
      </Button>
      <ResponsiveDialog
        trigger={
          <Button
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
          >
            <Trash2 className='h-4 w-4' />
            <span className={cn('hidden', sidebar.open ? 'lg:inline' : 'sm:inline')}>
              Remove
            </span>
          </Button>
        }
        title='Remove Containers'
        description={
          <p className='text-sm text-muted-foreground'>
            Are you sure you want to remove the containers{' '}
            <span className='font-mono'>{data.name}</span>? This action cannot be undone.
          </p>
        }
        footer={(close) => (
          <>
            <Button variant='outline' onClick={() => close()}>Cancel</Button>
            <Button
              variant='destructive'
              className='cursor-pointer'
              onClick={() => {
                removeMutation.mutate({ name: data.name, force: true })
                close()
              }}
            >
              <Trash2 className='h-4 w-4' />
              Remove
            </Button>
          </>
        )}
      />
    </>
  )

  return (
    <DataDetailsScreen
      title={data.name}
      subtitle={`Containers running ${data.image}`}
      icon={<ContainerImageIcon image={data.image} className='h-8 w-8' />}
      badge={{
        text: data.status,
        className: getStatusColor(data.status),
      }}
      headerActions={headerActions}
      defaultTab='overview'
      tabs={[
        {
          id: 'overview',
          label: 'Overview',
          icon: <Info className='h-4 w-4 sm:mr-2' />,
          cards: [
            {
              title: 'Basic Information',
              description: 'Core container details and configuration',
              content: [
                {
                  label: 'Image',
                  value: data.image,
                  variant: 'mono',
                },
                {
                  label: 'Created',
                  value: data.createdAt ? formatDate(data.createdAt.toISOString()) : 'Unknown',
                },
                {
                  label: 'Restart Policy',
                  value: data.restartPolicy || 'unless-stopped',
                },
                {
                  label: 'Working Directory',
                  value: data.workingDir || 'N/A',
                  variant: 'mono',
                },
              ],
            },
            {
              title: 'Runtime Information',
              description: 'Current resource usage and runtime details',
              content: [
                {
                  title: 'Resources',
                  items: [
                    {
                      label: 'CPU Usage',
                      value: data.cpu,
                      variant: 'mono',
                    },
                    {
                      label: 'Memory Usage',
                      value: data.memory,
                      variant: 'mono',
                    },
                  ],
                },
                {
                  title: 'Port Mappings',
                  items: data.ports?.map((port) => ({
                    value: port.name
                      ? `${port.name}:${port.number}/${port.protocol}`
                      : `${port.number}/${port.protocol}`,
                    variant: 'mono' as const,
                    fullWidth: true,
                  })),
                },
                {
                  title: 'Routes',
                  items: data.routes.map((route) => ({
                    value: route,
                    variant: 'link' as const,
                    fullWidth: true,
                  })),
                },
              ],
            },
            {
              title: 'Replica Instances',
              description: 'Detailed information about each container instance',
              content: (
                <div className='space-y-4'>
                  {data.replicas.instances.map((instance: any) => (
                    <div key={instance.name} className='border rounded-lg p-4 hover:bg-muted/10 transition-colors'>
                      <div className='flex items-center justify-between mb-3'>
                        <div className='flex items-center gap-3'>
                          <div className='flex items-center gap-2'>
                            <div
                              className={`w-3 h-3 rounded-full ${
                                instance.status === 'running'
                                  ? 'bg-chart-2'
                                  : instance.status === 'starting'
                                  ? 'bg-chart-4'
                                  : 'bg-destructive'
                              }`}
                            >
                            </div>
                            <span className='font-medium'>{instance.name}</span>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}
                          >
                            {instance.status}
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <button
                            type='button'
                            onClick={() =>
                              navigator.clipboard.writeText(instance.name)}
                            className='p-1 hover:bg-muted rounded'
                            title='Copy instance ID'
                          >
                            <Copy className='h-4 w-4' />
                          </button>
                        </div>
                      </div>

                      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                        <div>
                          <div className='text-muted-foreground'>CPU</div>
                          <div className='font-mono'>{instance.cpu}</div>
                        </div>
                        <div>
                          <div className='text-muted-foreground'>Memory</div>
                          <div className='font-mono'>{instance.memory}</div>
                        </div>
                      </div>

                      <div className='mt-3 text-xs text-muted-foreground'>
                        Created: {formatDate(instance.created)}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ],
        },
        {
          id: 'config',
          label: 'Configuration',
          icon: <Settings className='h-4 w-4 sm:mr-2' />,
          cards: [
            {
              title: 'Environment Variables',
              description: 'Environment variables configured for these containers',
              content: (
                <div className='grid grid-cols-1 gap-4'>
                  {Object.entries(data.environment).map(([key, value]) => (
                    <div key={key} className='flex justify-between items-center p-3 bg-muted/60 rounded-lg'>
                      <span className='text-foreground font-medium font-mono'>{key}</span>
                      <div className='flex items-center gap-2'>
                        <Badge variant='outline' className='font-mono'>{value}</Badge>
                        <button
                          type='button'
                          onClick={() =>
                            navigator.clipboard.writeText(value)}
                          className='p-1 hover:bg-muted rounded'
                          title='Copy value'
                        >
                          <Copy className='h-3 w-3' />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              title: 'Storage & Networking',
              description: 'Volume mounts and network configuration',
              content: (
                <>
                  {/* Volumes */}
                  {data.volumes && data.volumes.length > 0 && (
                    <div className='mb-4'>
                      <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2'>
                        Volume Mounts
                      </h4>
                      <div className='space-y-1'>
                        {data.volumes.map((volume, index) => (
                          <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                            {volume}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ),
            },
          ],
        },
        {
          id: 'logs',
          label: 'Logs',
          icon: <FileText className='h-4 w-4 sm:mr-2' />,
          className: '-mx-6 sm:mx-0',
          content: (
            <ContainerLogs
              containerName={data.name}
              replicas={data.replicas.instances}
            />
          ),
        },
        // {
        //   id: 'exec',
        //   label: 'Exec',
        //   icon: <Settings className='h-4 w-4 sm:mr-2' />,
        //   content: (
        //     <ContainerExec
        //       containerName={data.name}
        //       replicas={data.replicas.instances}
        //     />
        //   ),
        // },
      ]}
    />
  )
}
