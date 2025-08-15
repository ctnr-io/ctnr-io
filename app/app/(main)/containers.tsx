'use dom'

import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { useRouter } from 'expo-router'
import { Container, Eye, Play, RotateCcw, Settings, Square, Trash2 } from 'lucide-react'

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
}

// Mock data for containers
const containers: ContainerData[] = [
  {
    id: 'cont_1a2b3c4d',
    name: 'web-app-frontend',
    image: 'nginx:alpine',
    status: 'running',
    created: '2024-01-15T10:30:00Z',
    ports: ['80:3000', '443:3001'],
    cpu: '0.5%',
    memory: '128MB',
  },
  {
    id: 'cont_5e6f7g8h',
    name: 'api-backend',
    image: 'node:18-alpine',
    status: 'running',
    created: '2024-01-15T09:15:00Z',
    ports: ['8080:8080'],
    cpu: '2.1%',
    memory: '256MB',
  },
  {
    id: 'cont_9i0j1k2l',
    name: 'database',
    image: 'postgres:15',
    status: 'stopped',
    created: '2024-01-14T16:45:00Z',
    ports: ['5432:5432'],
    cpu: '0%',
    memory: '0MB',
  },
  {
    id: 'cont_3m4n5o6p',
    name: 'redis-cache',
    image: 'redis:7-alpine',
    status: 'running',
    created: '2024-01-15T08:20:00Z',
    ports: ['6379:6379'],
    cpu: '0.8%',
    memory: '64MB',
  },
  {
    id: 'cont_7q8r9s0t',
    name: 'worker-queue',
    image: 'python:3.11-slim',
    status: 'restarting',
    created: '2024-01-15T11:00:00Z',
    ports: [],
    cpu: '1.2%',
    memory: '192MB',
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

export default function ContainersScreen() {
  const router = useRouter()

  const handleRowClick = (container: ContainerData) => {
    router.push(`/containers/${container.id}`)
  }

  // Define table columns
  const columns: TableColumn<ContainerData>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (value, _item) => (
        <div className='flex items-center gap-2'>
          <Container className='h-4 w-4 text-muted-foreground' />
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
        label: 'Create Container',
        icon: Container,
        onClick: () => console.log('Create container'),
      }}
      infoDescription='View and manage all your containers in one place. Start, stop, restart, and monitor your containers with real-time status updates. You can also view logs, attach to containers, and manage port forwarding.'
      data={containers}
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
      onRowClick={handleRowClick}
      rowClickable={true}
      searchable
      searchPlaceholder='Search containers by name, image, or status...'
      searchKeys={['name', 'image', 'status']}
      columnFilterable
      defaultVisibleColumns={['name', 'image', 'status', 'ports', 'cpu', 'memory']}
      emptyMessage='No containers found. Create your first container to get started.'
    />
  )
}
