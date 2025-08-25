'use dom'

import { ContainerExec } from 'app/components/ctnr-io/container-exec.tsx'
import { ContainerImageIcon } from 'app/components/ctnr-io/container-image-icon.tsx'
import { ContainerLogs } from 'app/components/ctnr-io/container-logs.tsx'
import { DataItemScreen, ItemAction, ItemSection, ItemTab } from 'app/components/ctnr-io/data-item-screen.tsx'
import { Copy, FileText, Info, Play, RotateCcw, Settings, Square, Terminal, Trash2 } from 'lucide-react'

// Example container detail data
const containerData = {
  id: 'cont_1a2b3c4d',
  name: 'web-app-frontend',
  image: 'nginx:alpine',
  status: 'running',
  created: '2024-01-15T10:30:00Z',
  ports: ['web:80/tcp', 'https:443/tcp'],
  cpu: '0.5%',
  memory: '128MB',
  restartPolicy: 'unless-stopped',
  command: 'nginx -g "daemon off;"',
  workingDir: '/usr/share/nginx/html',
  routes: [
    'https://web-app-frontend-user123.ctnr.io',
    'https://myapp.example.com',
    'https://staging.myapp.com',
  ],
  replicas: {
    max: 5,
    min: 2,
    current: 3,
    instances: [
      {
        id: 'cont_1a2b3c4d-1',
        name: 'web-app-frontend-1',
        status: 'running',
        node: 'node-01',
        created: '2024-01-15T10:30:00Z',
        cpu: '0.2%',
        memory: '42MB',
      },
      {
        id: 'cont_1a2b3c4d-2',
        name: 'web-app-frontend-2',
        status: 'running',
        node: 'node-02',
        created: '2024-01-15T10:30:05Z',
        cpu: '0.1%',
        memory: '38MB',
      },
      {
        id: 'cont_1a2b3c4d-3',
        name: 'web-app-frontend-3',
        status: 'starting',
        node: 'node-03',
        created: '2024-01-15T10:30:10Z',
        cpu: '0.2%',
        memory: '48MB',
      },
    ],
  },
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
  // Helper function to render section content
  const renderSectionContent = (section: ItemSection) => (
    <div className='bg-card border rounded-xl overflow-hidden'>
      <div className='bg-gradient-to-r from-muted/30 to-muted/10 p-6 border-b'>
        <h2 className='text-xl font-semibold text-foreground'>{section.title}</h2>
        {section.description && (
          <p className='text-sm text-muted-foreground mt-2 leading-relaxed'>
            {section.description}
          </p>
        )}
      </div>

      <div className='p-6'>
        {/* Desktop Layout */}
        <div className='hidden md:block'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {section.fields.map((field, fieldIndex) => (
              <div key={fieldIndex} className='space-y-2'>
                <label className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
                  {field.label}
                </label>
                <div className={`flex items-start gap-3 bg-muted/20 rounded-lg border ${field.className || ''}`}>
                  <div className='flex-1 min-w-0 p-3'>
                    <div className='text-sm font-medium text-foreground break-words'>
                      {field.render ? field.render(field.value) : (
                        field.value === null || field.value === undefined
                          ? <span className='text-muted-foreground'>-</span>
                          : Array.isArray(field.value)
                          ? (
                            field.value.length > 0 ? field.value.join(', ') : '-'
                          )
                          : String(field.value)
                      )}
                    </div>
                  </div>
                  {field.copyable && field.value && (
                    <button
                      type='button'
                      onClick={() => navigator.clipboard.writeText(String(field.value))}
                      className='h-8 w-8 mt-1.5 mx-2 hover:bg-primary/10 flex-shrink-0 rounded flex items-center justify-center'
                      title='Copy to clipboard'
                    >
                      <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className='block md:hidden space-y-4'>
          {section.fields
            .filter((field) => !field.hiddenOnMobile)
            .map((field, fieldIndex) => (
              <div key={fieldIndex} className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <label className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
                    {field.label}
                  </label>
                  {field.copyable && field.value && (
                    <button
                      type='button'
                      onClick={() => navigator.clipboard.writeText(String(field.value))}
                      className='h-8 w-8 p-0 hover:bg-primary/10 rounded flex items-center justify-center'
                      title='Copy to clipboard'
                    >
                      <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                        />
                      </svg>
                    </button>
                  )}
                </div>
                <div className={`p-3 bg-muted/20 rounded-lg border ${field.className || ''}`}>
                  <div className='text-sm font-medium text-foreground break-words'>
                    {field.render ? field.render(field.value) : (
                      field.value === null || field.value === undefined
                        ? <span className='text-muted-foreground'>-</span>
                        : Array.isArray(field.value)
                        ? (
                          field.value.length > 0 ? field.value.join(', ') : '-'
                        )
                        : String(field.value)
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )

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
          key: 'replicas',
          label: 'Replicas',
          value:
            `${containerData.replicas.current} current (${containerData.replicas.min}-${containerData.replicas.max})`,
          render: () => (
            <div className='flex items-center gap-2'>
              <div className='flex items-center gap-1'>
                <span className='text-sm font-medium'>
                  {containerData.replicas.current}
                </span>
                <span className='text-xs text-muted-foreground'>current</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-2 h-2 rounded-full bg-blue-500'></div>
                <span className='text-xs text-muted-foreground'>
                  {containerData.replicas.min}-{containerData.replicas.max} range
                </span>
              </div>
            </div>
          ),
        },
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
          key: 'routes',
          label: 'Routes',
          value: containerData.routes,
          render: (routes: string[]) => (
            <div className='space-y-1'>
              {routes.length === 0 ? <span className='text-muted-foreground'>No routes configured</span> : (
                routes.map((route, index) => (
                  <div key={index} className='flex items-center gap-2'>
                    <a
                      href={route}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-blue-600 hover:text-blue-800 underline text-sm font-mono bg-muted px-2 py-1 rounded'
                    >
                      {route}
                    </a>
                    <button
                      type='button'
                      onClick={() => navigator.clipboard.writeText(route)}
                      className='p-1 hover:bg-muted rounded'
                      title='Copy route URL'
                    >
                      <Copy className='h-3 w-3' />
                    </button>
                  </div>
                ))
              )}
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

  // Define tabs
  const tabs: ItemTab[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Info,
      content: (
        <div className='space-y-6'>
          {/* Runtime Information first, then Basic Information */}
          <div>
            {renderSectionContent(sections[1])}
          </div>
          <div>
            {renderSectionContent(sections[0])}
          </div>

          {/* Replica Status & Instances */}
          <div className='bg-card border rounded-xl overflow-hidden'>
            <div className='bg-gradient-to-r from-muted/30 to-muted/10 p-6 border-b'>
              <h2 className='text-xl font-semibold text-foreground'>Replica Management</h2>
              <p className='text-sm text-muted-foreground mt-2 leading-relaxed'>
                Overview of replica status and detailed information about each container instance
              </p>
            </div>
            <div className='p-6'>
              {/* Status Summary */}
              <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
                <div className='text-center p-4 bg-blue-50 rounded-lg'>
                  <div className='text-2xl font-bold text-blue-600'>{containerData.replicas.min}</div>
                  <div className='text-sm text-blue-600'>Minimum</div>
                </div>
                <div className='text-center p-4 bg-green-50 rounded-lg'>
                  <div className='text-2xl font-bold text-green-600'>{containerData.replicas.current}</div>
                  <div className='text-sm text-green-600'>Current</div>
                </div>
                <div className='text-center p-4 bg-orange-50 rounded-lg'>
                  <div className='text-2xl font-bold text-orange-600'>{containerData.replicas.max}</div>
                  <div className='text-sm text-orange-600'>Maximum</div>
                </div>
              </div>

              {/* Replica Instances */}
              <div className='border-t pt-6'>
                <h3 className='text-lg font-semibold text-foreground mb-4'>Replica Instances</h3>
                <div className='space-y-4'>
                  {containerData.replicas.instances.map((instance) => (
                    <div key={instance.id} className='border rounded-lg p-4 hover:bg-muted/10 transition-colors'>
                      <div className='flex items-center justify-between mb-3'>
                        <div className='flex items-center gap-3'>
                          <div className='flex items-center gap-2'>
                            <div
                              className={`w-3 h-3 rounded-full ${
                                instance.status === 'running'
                                  ? 'bg-green-500'
                                  : instance.status === 'starting'
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
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
                              navigator.clipboard.writeText(instance.id)}
                            className='p-1 hover:bg-muted rounded'
                            title='Copy instance ID'
                          >
                            <Copy className='h-4 w-4' />
                          </button>
                        </div>
                      </div>

                      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                        <div>
                          <div className='text-muted-foreground'>Instance ID</div>
                          <div className='font-mono text-xs'>{instance.id}</div>
                        </div>
                        <div>
                          <div className='text-muted-foreground'>Node</div>
                          <div className='font-medium'>{instance.node}</div>
                        </div>
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
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'config',
      label: 'Configuration',
      icon: Settings,
      content: (
        <div className='space-y-6'>
          {sections.slice(2).map((section, index) => (
            <div key={index}>
              {renderSectionContent(section)}
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: FileText,
      content: (
        <ContainerLogs
          containerId={containerData.id}
          containerName={containerData.name}
          replicas={containerData.replicas.instances}
        />
      ),
    },
    {
      id: 'exec',
      label: 'Exec',
      icon: Terminal,
      content: (
        <ContainerExec
          containerId={containerData.id}
          containerName={containerData.name}
          replicas={containerData.replicas.instances}
        />
      ),
    },
  ]

  // Define actions
  const secondaryActions: ItemAction[] = [
    {
      icon: Play,
      label: 'Start',
      onClick: () => console.log('Start'),
      variant: containerData.status !== 'running' ? 'outline' : 'secondary',
    },
    {
      icon: Square,
      label: 'Stop',
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
      icon={({ className, ref }) => <ContainerImageIcon ref={ref} image={containerData.image} className={className} />}
      status={{
        label: containerData.status,
        className: getStatusColor(containerData.status),
      }}
      secondaryActions={secondaryActions}
      tabs={tabs}
      defaultTab='overview'
      breadcrumb={{
        items: [
          { label: 'Containers', href: '/containers' },
          { label: containerData.name },
        ],
      }}
    />
  )
}
