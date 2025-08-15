'use dom'

import { DataItemScreen, ItemAction, ItemSection } from 'app/components/ctnr-io/data-item-screen.tsx'
import { Container, Edit, Eye, Play, RotateCcw, Settings, Square, Terminal, Trash2 } from 'lucide-react'

// Example container detail data
const containerData = {
  id: 'cont_1a2b3c4d',
  name: 'web-app-frontend',
  image: 'nginx:alpine',
  status: 'running',
  created: '2024-01-15T10:30:00Z',
  ports: ['80:3000', '443:3001'],
  cpu: '0.5%',
  memory: '128MB',
  restartPolicy: 'unless-stopped',
  command: 'nginx -g "daemon off;"',
  workingDir: '/usr/share/nginx/html',
  environment: {
    NODE_ENV: 'production',
    API_URL: 'https://api.example.com',
    PORT: '3000',
  },
  volumes: [
    '/host/path:/container/path:ro',
    'volume-name:/data',
  ],
  networks: ['frontend', 'backend'],
  labels: {
    'com.example.service': 'web',
    'com.example.version': '1.0.0',
  },
}

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

export default function ContainerDetailScreen() {
  // Define sections
  const sections: ItemSection[] = [
    {
      title: 'Basic Information',
      description: 'Core container details and configuration',
      fields: [
        {
          key: 'id',
          label: 'Container ID',
          value: containerData.id,
          copyable: true,
          className: 'font-mono text-sm',
        },
        {
          key: 'name',
          label: 'Name',
          value: containerData.name,
          copyable: true,
          className: 'font-medium',
        },
        {
          key: 'image',
          label: 'Image',
          value: containerData.image,
          copyable: true,
          className: 'font-mono text-sm',
        },
        {
          key: 'created',
          label: 'Created',
          value: formatDate(containerData.created),
        },
        {
          key: 'restartPolicy',
          label: 'Restart Policy',
          value: containerData.restartPolicy,
        },
        {
          key: 'command',
          label: 'Command',
          value: containerData.command,
          className: 'font-mono text-sm',
        },
      ],
    },
    {
      title: 'Runtime Information',
      description: 'Current resource usage and runtime details',
      fields: [
        {
          key: 'cpu',
          label: 'CPU Usage',
          value: containerData.cpu,
          className: 'font-mono text-sm',
        },
        {
          key: 'memory',
          label: 'Memory Usage',
          value: containerData.memory,
          className: 'font-mono text-sm',
        },
        {
          key: 'ports',
          label: 'Port Mappings',
          value: containerData.ports,
          render: (ports: string[]) => (
            <div className='space-y-1'>
              {ports.map((port, index) => (
                <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                  {port}
                </div>
              ))}
            </div>
          ),
        },
        {
          key: 'workingDir',
          label: 'Working Directory',
          value: containerData.workingDir,
          className: 'font-mono text-sm',
        },
      ],
    },
    {
      title: 'Environment Variables',
      description: 'Environment variables configured for this container',
      fields: Object.entries(containerData.environment).map(([key, value]) => ({
        key,
        label: key,
        value,
        copyable: true,
        className: 'font-mono text-sm',
      })),
    },
    {
      title: 'Storage & Networking',
      description: 'Volume mounts and network configuration',
      fields: [
        {
          key: 'volumes',
          label: 'Volume Mounts',
          value: containerData.volumes,
          render: (volumes: string[]) => (
            <div className='space-y-1'>
              {volumes.map((volume, index) => (
                <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                  {volume}
                </div>
              ))}
            </div>
          ),
        },
        {
          key: 'networks',
          label: 'Networks',
          value: containerData.networks,
          render: (networks: string[]) => (
            <div className='flex flex-wrap gap-1'>
              {networks.map((network, index) => (
                <span
                  key={index}
                  className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600'
                >
                  {network}
                </span>
              ))}
            </div>
          ),
        },
      ],
    },
    {
      title: 'Labels',
      description: 'Metadata labels attached to this container',
      fields: Object.entries(containerData.labels).map(([key, value]) => ({
        key,
        label: key,
        value,
        copyable: true,
        className: 'font-mono text-sm',
      })),
    },
  ]

  // Define actions
  const secondaryActions: ItemAction[] = [
		{
      icon: Play,
      label: 'Start',
      onClick: () => 'Start',
      variant: containerData.status !== 'running' ? 'outline' : 'secondary',
		},
    {
      icon: Square,
      label:'Stop',
      onClick: () => console.log('Stop'),
      variant: containerData.status !== 'stopped' ? 'outline' : 'secondary',
    },
    {
      icon: RotateCcw,
      label: 'Restart',
      onClick: () => console.log('Restart container'),
      variant: 'outline',
    },
    {
      icon: Terminal,
      label: 'Exec',
      onClick: () => console.log('Execute command in container'),
      variant: 'outline',
    },
    {
      icon: Eye,
      label: 'Logs',
      onClick: () => console.log('View logs'),
      variant: 'outline',
    },
    {
      icon: Trash2,
      label: 'Delete',
      onClick: () => console.log('Delete container'),
      variant: 'ghost',
      className: 'text-destructive hover:text-destructive',
    },
  ]

  return (
    <DataItemScreen
      title={containerData.name}
      description={`Container running ${containerData.image}`}
      icon={Container}
      status={{
        label: containerData.status,
        className: getStatusColor(containerData.status),
      }}
      // primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      sections={sections}
      breadcrumb={{
        items: [
          { label: 'Containers', href: '/containers' },
          { label: containerData.name },
        ],
      }}
    >
      {/* Additional custom content can go here */}
      <div className='p-4'>
        <h3 className='font-semibold mb-2'>Quick Actions</h3>
        <p className='text-sm text-muted-foreground'>
          Use the action buttons above to manage this container, or explore the detailed information in each section.
        </p>
      </div>
    </DataItemScreen>
  )
}
