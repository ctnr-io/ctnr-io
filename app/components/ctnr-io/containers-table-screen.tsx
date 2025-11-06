'use dom'

import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { ContainerImageIcon } from 'app/components/ctnr-io/container-image-icon.tsx'
import { Container, Copy, Eye, Play, RotateCcw, Settings, Square, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useRouter } from 'expo-router'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '../shadcn/ui/dialog.tsx'
import { Button } from '../shadcn/ui/button.tsx'
import Ansi from 'ansi-to-react'
import { cn } from 'lib/shadcn/utils.ts'
import { Label } from '../shadcn/ui/label.tsx'

// Container type definition
interface ContainerData {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'restarting'
  created: string
  ports: string[]
  cpu: string
  memory: string
  replicas: {
    max: number
    min: number
    current: number
  }
  routes: string[]
  clusters: string[]
}

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

export default function ContainersTableScreen({
  data,
  isLoading = false,
  onRowClick,
}: {
  data: ContainerData[]
  isLoading?: boolean
  onRowClick: (container: ContainerData) => void
}) {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const router = useRouter()

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

  const isPending = startMutation.isPending ||
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

  // Define table columns
  const columns: TableColumn<ContainerData>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (value, item) => (
        <div className='flex items-center gap-2'>
          <ContainerImageIcon image={item.image} className='h-4 w-4' />
          <span className='font-medium'>{value}</span>
        </div>
      ),
      className: 'font-medium',
    },
    {
      key: 'image',
      label: 'Image',
      className: 'font-mono text-sm',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'replicas',
      label: 'Replicas',
      render: (_value, item) => (
        <div className='flex items-center gap-2'>
          <span className='text-sm font-medium'>
            {item.replicas.current}
          </span>
          <div className='flex items-center gap-1'>
            <div
              className={`w-2 h-2 rounded-full ${
                item.replicas.current >= item.replicas.min
                  ? 'bg-chart-2'
                  : item.replicas.current > 0
                  ? 'bg-chart-4'
                  : 'bg-destructive'
              }`}
            >
            </div>
            <span className='text-xs text-muted-foreground'>
              {item.replicas.min}-{item.replicas.max} range
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'ports',
      label: 'Ports',
      render: (value: string[]) => value.length > 0 ? value.join(', ') : '-',
      className: 'font-mono text-sm',
    },
    {
      key: 'cpu',
      label: 'CPU',
      className: 'font-mono text-sm',
    },
    {
      key: 'memory',
      label: 'Memory',
      className: 'font-mono text-sm',
    },
    {
      key: 'clusters',
      label: 'Clusters',
      render: (value: string[]) => {
        if (value.length === 0) return '-'
        return (
          <div className='flex flex-wrap gap-1'>
            {value.map((cluster, index) => (
              <span
                key={index}
                className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20'
              >
                {cluster}
              </span>
            ))}
          </div>
        )
      },
      className: 'text-sm',
    },
    {
      key: 'routes',
      label: 'Routes',
      render: (value: string[]) => {
        if (value.length === 0) return '-'
        if (value.length === 1) {
          return (
            <a
              href={value[0]}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:text-primary/80 underline text-sm'
              onClick={(e) => e.stopPropagation()}
            >
              {value[0].replace(/^https?:\/\//, '')}
            </a>
          )
        }
        return (
          <div className='flex flex-col gap-1'>
            {value.slice(0, 2).map((route, index) => (
              <a
                key={index}
                href={route}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-600 hover:text-blue-800 underline text-xs'
                onClick={(e) => e.stopPropagation()}
              >
                {route.replace(/^https?:\/\//, '')}
              </a>
            ))}
            {value.length > 2 && (
              <span className='text-xs text-muted-foreground'>
                +{value.length - 2} more
              </span>
            )}
          </div>
        )
      },
      className: 'text-sm',
    },
    {
      key: 'created',
      label: 'Created',
      render: (value) => formatDate(value),
      className: 'text-sm text-muted-foreground',
    },
  ]

  // Define table actions
  const actions: TableAction<ContainerData>[] = [
    {
      icon: Square,
      label: 'Stop Container',
      onClick: (container) => stopMutation.mutate({ name: container.name }),
      condition: (container) => container.status === 'running',
      disabled: isPending,
    },
    {
      icon: Play,
      label: 'Start Container',
      onClick: (container) => startMutation.mutate({ name: container.name }),
      condition: (container) => container.status === 'stopped',
      disabled: isPending,
    },
    {
      icon: RotateCcw,
      label: 'Restart Container',
      onClick: (container) => restartMutation.mutate({ name: container.name }),
      disabled: isPending,
    },
    {
      icon: Eye,
      label: 'View Logs',
      onClick: (container) => router.push(`/containers/${container.name}/logs`),
      disabled: isPending,
    },
    {
      icon: Settings,
      label: 'Container Settings',
      onClick: (container) => router.push(`/containers/${container.name}/settings`),
      disabled: isPending,
    },
    {
      icon: Trash2,
      label: 'Delete Container',
      disabled: isPending,
      variant: 'ghost',
      className: 'text-destructive hover:text-destructive',
      Wrapper: useCallback(({ item, children }: { item: ContainerData; children: ReactNode }) => {
        const [open, setOpen] = useState(false)
        return (
          <>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                onClick={(e) => {
                  // Prevent triggering the row onClick when opening the dialog
                  e.stopPropagation()
                  setOpen(true)
                }}
                asChild
              >
                {children}
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Remove Containers</DialogTitle>
                <DialogDescription>
                  <p className='text-sm text-muted-foreground'>
                    Are you sure you want to remove the containers{' '}
                    <span className='font-mono'>{item.name}</span>? This action cannot be undone.
                  </p>
                </DialogDescription>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant='outline'>Cancel</Button>
                  </DialogClose>
                  <Button
                    variant='destructive'
                    className='cursor-pointer'
                    onClick={() => removeMutation.mutate({ name: item.name, force: true })}
                  >
                    <Trash2 className='h-4 w-4' />
                    Remove
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )
      }, []),
    },
  ]

  const [runDialogOpen, setRunDialogOpen] = useState(false)

  function TerminalLine({
    className,
    prefix = '$',
    text,
  }: {
    className?: string
    prefix?: string
    text: string
  }) {
    const [copied, setCopied] = useState(false)
    const handleCopy = async () => {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    }
    return (
      <Button
        type='button'
        variant='ghost'
        onClick={handleCopy}
        className={cn(
          'group flex items-center flex-1 bg-gray-900 border border-slate-700 rounded  transition hover:bg-gray-800 focus:outline-none justify-between',
          'cursor-pointer',
          className,
          copied ? 'ring-2 ring-yellow-500' : '',
        )}
        title={copied ? 'Copied!' : 'Copy'}
        tabIndex={0}
      >
        <span className='font-mono text-sm text-gray-100 select-text flex-1 text-left'>
          <span className='text-gray-500 mr-2'>{prefix}</span>
          {text}
        </span>
        <span className='ml-2 flex items-center'>
          <Copy
            className={cn('h-4 w-4 transition', copied ? 'text-yellow-400' : 'text-gray-400 group-hover:text-white')}
          />
          {copied && <span className='ml-2 text-xs text-yellow-400 font-semibold transition'>Copied</span>}
        </span>
      </Button>
    )
  }

  return (
    <>
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className='!max-w-fit'>
          <DialogTitle>Install &amp; Run CLI</DialogTitle>
          <DialogDescription>
            <div className='space-y-4 flex flex-col'>
              <Label>Install CLI</Label>
              <TerminalLine text='curl -fsSL https://get.ctnr.io | bash' />
              <Label>Login</Label>
              <TerminalLine text='ctnr login' />
              <Label>Run an ubuntu Container</Label>
              <TerminalLine text='ctnr run --name ubuntu --image ubuntu:latest -i -t' />
            </div>
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline'>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DataTableScreen<ContainerData>
        title='Containers'
        description='Manage and monitor your application containers'
        icon={Container}
        primaryAction={{
          label: 'Run Container',
          icon: Container,
          onClick: () => setRunDialogOpen(true),
        }}
        infoDescription='View and manage all your containers in one place. Start, stop, restart, and monitor your containers with real-time status updates. You can also view logs, attach to containers, and manage port forwarding.'
        data={data}
        columns={columns}
        actions={actions}
        tableTitle='All Containers'
        tableDescription={`${data.length} containers deployments total • ${
          data.filter((c) => c.status === 'running').length
        } running`}
        mobileCardTitle={(item) => item.name}
        mobileCardStatus={(item) => ({
          label: item.status,
          className: getStatusColor(item.status),
        })}
        mobileCardIcon={(item) => <ContainerImageIcon image={item.image} className='h-4 w-4' />}
        onRowClick={onRowClick}
        rowClickable
        searchable
        searchPlaceholder='Search containers by name, image, status, or clusters...'
        searchKeys={['name', 'image', 'status', 'clusters']}
        columnFilterable
        defaultVisibleColumns={['name', 'image', 'status', 'replicas', 'cpu', 'memory']}
        emptyMessage='No containers found. Create your first container to get started.'
        loading={isLoading}
      />
    </>
  )
}
