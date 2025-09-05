'use dom'

import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { ContainerImageIcon } from 'app/components/ctnr-io/container-image-icon.tsx'
import { Coins, Container, Eye, Play, RotateCcw, Settings, Square, Trash2 } from 'lucide-react'
import { calculateCost } from 'lib/billing/utils.ts'

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
  cost: {
    hourly: number
    daily: number
    monthly: number
  }
}

// Mock data for containers with calculated costs
const containers: ContainerData[] = [
  {
    id: 'cont_1a2b3c4d',
    name: 'web-app-frontend',
    image: 'nginx:alpine',
    status: 'running',
    created: '2024-01-15T10:30:00Z',
    ports: ['web:80/tcp', 'https:443/tcp'],
    cpu: '250m',
    memory: '512Mi',
    replicas: {
      max: 5,
      min: 2,
      current: 3,
    },
    routes: ['https://web-app-frontend-user123.ctnr.io', 'https://myapp.example.com'],
    clusters: ['eu-0', 'us-west-2'],
    cost: calculateCost('250m', '512Mi', 3),
  },
  {
    id: 'cont_5e6f7g8h',
    name: 'api-backend',
    image: 'node:18-alpine',
    status: 'running',
    created: '2024-01-15T09:15:00Z',
    ports: ['api:8080/tcp'],
    cpu: '500m',
    memory: '512Mi',
    replicas: {
      max: 3,
      min: 1,
      current: 2,
    },
    routes: ['https://api-backend-user123.ctnr.io'],
    clusters: ['eu-0'],
    cost: calculateCost('500m', '512Mi', 2),
  },
  {
    id: 'cont_9i0j1k2l',
    name: 'database',
    image: 'postgres:15',
    status: 'stopped',
    created: '2024-01-14T16:45:00Z',
    ports: ['5432/tcp'],
    cpu: '250m',
    memory: '512Mi',
    replicas: {
      max: 1,
      min: 1,
      current: 0,
    },
    routes: [],
    clusters: ['eu-2', 'us-east-1'],
    cost: calculateCost('250m', '512Mi', 0),
  },
  {
    id: 'cont_3m4n5o6p',
    name: 'redis-cache',
    image: 'redis:7-alpine',
    status: 'running',
    created: '2024-01-15T08:20:00Z',
    ports: ['6379/tcp'],
    cpu: '250m',
    memory: '512Mi',
    replicas: {
      max: 2,
      min: 1,
      current: 1,
    },
    routes: [],
    clusters: ['eu-0', 'eu-2', 'us-east-1'],
    cost: calculateCost('250m', '512Mi', 1),
  },
  {
    id: 'cont_7q8r9s0t',
    name: 'worker-queue',
    image: 'python:3.11-slim',
    status: 'restarting',
    created: '2024-01-15T11:00:00Z',
    ports: [],
    cpu: '300m',
    memory: '512Mi',
    replicas: {
      max: 6,
      min: 2,
      current: 3,
    },
    routes: [],
    clusters: ['development'],
    cost: calculateCost('300m', '512Mi', 3),
  },
]

function getStatusColor(status: string) {
  switch (status) {
    case 'running':
      return 'text-green-600 bg-green-50'
    case 'stopped':
      return 'text-red-600 bg-red-50'
    case 'restarting':
      return 'text-yellow-600 bg-yellow-50'
    default:
      return 'text-gray-600 bg-gray-50'
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
                  ? 'bg-green-500'
                  : item.replicas.current > 0
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
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
      key: 'cost',
      label: 'Daily cost',
      render: (_value, item) => (
        <div className='text-sm inline-flex gap-1'>
          <Coins className='h-3 w-3 text-gray-600 self-center' /> {item.cost.daily}
        </div>
      ),
      className: 'text-sm',
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
                className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200'
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
              className='text-blue-600 hover:text-blue-800 underline text-sm'
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
      onClick: (container) => console.log('Stop', container.name),
      condition: (container) => container.status === 'running',
    },
    {
      icon: Play,
      label: 'Start Container',
      onClick: (container) => console.log('Start', container.name),
      condition: (container) => container.status === 'stopped',
    },
    {
      icon: RotateCcw,
      label: 'Restart Container',
      onClick: (container) => console.log('Restart', container.name),
    },
    {
      icon: Eye,
      label: 'View Logs',
      onClick: (container) => console.log('View logs', container.name),
    },
    {
      icon: Settings,
      label: 'Container Settings',
      onClick: (container) => console.log('Settings', container.name),
    },
    {
      icon: Trash2,
      label: 'Delete Container',
      onClick: (container) => console.log('Delete', container.name),
      variant: 'ghost',
      className: 'text-destructive hover:text-destructive',
    },
  ]

  return (
    <DataTableScreen<ContainerData>
      title='Containers'
      description='Manage and monitor your application containers'
      icon={Container}
      primaryAction={{
        label: 'Run Containers',
        icon: Container,
        onClick: () => console.log('Run containers'),
      }}
      infoDescription='View and manage all your containers in one place. Start, stop, restart, and monitor your containers with real-time status updates. You can also view logs, attach to containers, and manage port forwarding.'
      data={data}
      columns={columns}
      actions={actions}
      tableTitle='All Containers'
      tableDescription={`${containers.length} containers total • ${
        containers.filter((c) => c.status === 'running').length
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
  )
}
