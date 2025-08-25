'use dom'

import { ContainerExec } from 'app/components/ctnr-io/container-exec.tsx'
import { ContainerImageIcon } from 'app/components/ctnr-io/container-image-icon.tsx'
import { ContainerLogs } from 'app/components/ctnr-io/container-logs.tsx'
import { DataItemScreen, ItemAction, ItemSection, ItemTab } from 'app/components/ctnr-io/data-item-screen.tsx'
import { Copy, FileText, Info, Play, RotateCcw, Settings, Square, Terminal, Trash2 } from 'lucide-react'
import { Skeleton } from 'app/components/shadcn/ui/skeleton.tsx'

interface ContainerData {
  name: string
  image: any
  status: string
  createdAt: Date 
  ports: string[]
  cpu: string
  memory: string
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
  networks: string[]
}

// Fallback container data for when no data is available
const fallbackContainerData = {
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
        name: 'web-app-frontend-1',
        status: 'running',
        node: 'node-01',
        created: '2024-01-15T10:30:00Z',
        cpu: '0.2%',
        memory: '42MB',
      },
      {
        name: 'web-app-frontend-2',
        status: 'running',
        node: 'node-02',
        created: '2024-01-15T10:30:05Z',
        cpu: '0.1%',
        memory: '38MB',
      },
      {
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

export function ContainersDetailScreen(props: {
  data: ContainerData,
  isLoading: boolean,
}) {
  const {isLoading } = props

  // Create skeleton data for loading state
  const data = isLoading ? {
    name: '',
    image: '',
    status: '',
    createdAt: new Date(),
    ports: [],
    cpu: '',
    memory: '',
    replicas: {
      max: 0,
      min: 0,
      current: 0,
      instances: []
    },
    routes: [],
    clusters: [],
    restartPolicy: '',
    command: [],
    workingDir: '',
    environment: {},
    volumes: [],
    networks: [],
    labels: {}
  } : props.data

  // // Show error state
  // if (error) {
  //   return (
  //     <div className='container mx-auto p-6'>
  //       <div className='text-center py-12'>
  //         <h2 className='text-xl font-semibold text-foreground mb-2'>Container Not Found</h2>
  //         <p className='text-muted-foreground mb-4'>
  //           The container "{data.name}" could not be found or you don't have permission to access it.
  //         </p>
  //         <a
  //           href='/containers'
  //           className='inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
  //         >
  //           Back to Containers
  //         </a>
  //       </div>
  //     </div>
  //   )
  // }

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

  const sections: ItemSection[] = [
    {
      title: 'Basic Information',
      description: 'Core container details and configuration',
      fields: [
        {
          key: 'name',
          label: 'Name',
          value: data.name,
          copyable: !isLoading,
          className: 'font-medium',
          render: isLoading ? () => <Skeleton className='h-4 w-24' /> : undefined,
        },
        {
          key: 'image',
          label: 'Image',
          value: data.image,
          copyable: !isLoading,
          className: 'font-mono text-sm',
          render: isLoading ? () => <Skeleton className='h-4 w-40' /> : undefined,
        },
        {
          key: 'created',
          label: 'Created',
          value: data.createdAt ? formatDate(data.createdAt.toISOString()) : 'Unknown',
          render: isLoading ? () => <Skeleton className='h-4 w-28' /> : undefined,
        },
        {
          key: 'restartPolicy',
          label: 'Restart Policy',
          value: data.restartPolicy || 'unless-stopped',
          render: isLoading ? () => <Skeleton className='h-4 w-20' /> : undefined,
        },
        {
          key: 'command',
          label: 'Command',
          value: data.command || 'N/A',
          className: 'font-mono text-sm',
          render: isLoading ? () => <Skeleton className='h-4 w-36' /> : undefined,
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
          value: `${data.replicas.current} current (${data.replicas.min}-${data.replicas.max})`,
          render: isLoading ? () => <Skeleton className='h-4 w-32' /> : () => (
            <div className='flex items-center gap-2'>
              <div className='flex items-center gap-1'>
                <span className='text-sm font-medium'>
                  {data.replicas.current}
                </span>
                <span className='text-xs text-muted-foreground'>current</span>
              </div>
              <div className='flex items-center gap-1'>
                <div className='w-2 h-2 rounded-full bg-blue-500'></div>
                <span className='text-xs text-muted-foreground'>
                  {data.replicas.min}-{data.replicas.max} range
                </span>
              </div>
            </div>
          ),
        },
        {
          key: 'cpu',
          label: 'CPU Usage',
          value: data.cpu,
          className: 'font-mono text-sm',
          render: isLoading ? () => <Skeleton className='h-4 w-16' /> : undefined,
        },
        {
          key: 'memory',
          label: 'Memory Usage',
          value: data.memory,
          className: 'font-mono text-sm',
          render: isLoading ? () => <Skeleton className='h-4 w-20' /> : undefined,
        },
        {
          key: 'ports',
          label: 'Port Mappings',
          value: data.ports,
          render: isLoading ? () => (
            <div className='space-y-1'>
              <Skeleton className='h-6 w-24' />
              <Skeleton className='h-6 w-28' />
            </div>
          ) : (ports: string[]) => (
            <div className='space-y-1'>
              {ports.length === 0 ? <span className='text-muted-foreground'>No ports configured</span> : (
                ports.map((port, index) => (
                  <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                    {port}
                  </div>
                ))
              )}
            </div>
          ),
        },
        {
          key: 'routes',
          label: 'Routes',
          value: data.routes,
          render: isLoading ? () => (
            <div className='space-y-1'>
              <Skeleton className='h-6 w-48' />
              <Skeleton className='h-6 w-40' />
            </div>
          ) : (routes: string[]) => (
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
          value: data.workingDir,
          className: 'font-mono text-sm',
          render: isLoading ? () => <Skeleton className='h-4 w-32' /> : undefined,
        },
      ],
    },
    {
      title: 'Environment Variables',
      description: 'Environment variables configured for this container',
      fields: isLoading ? [
        { key: 'env1', label: 'Loading...', value: '', render: () => <Skeleton className='h-4 w-24' /> },
        { key: 'env2', label: 'Loading...', value: '', render: () => <Skeleton className='h-4 w-32' /> },
        { key: 'env3', label: 'Loading...', value: '', render: () => <Skeleton className='h-4 w-28' /> },
      ] : Object.entries(data.environment).map(([key, value]) => ({
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
          value: data.volumes,
          render: isLoading ? () => (
            <div className='space-y-1'>
              <Skeleton className='h-6 w-40' />
              <Skeleton className='h-6 w-36' />
            </div>
          ) : (volumes: string[]) => (
            <div className='space-y-1'>
              {volumes.length === 0 ? <span className='text-muted-foreground'>No volumes configured</span> : (
                volumes.map((volume, index) => (
                  <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                    {volume}
                  </div>
                ))
              )}
            </div>
          ),
        },
      ],
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
                  <div className='text-2xl font-bold text-blue-600'>
                    {isLoading ? <Skeleton className='h-8 w-8 mx-auto' /> : data.replicas.min}
                  </div>
                  <div className='text-sm text-blue-600'>Minimum</div>
                </div>
                <div className='text-center p-4 bg-green-50 rounded-lg'>
                  <div className='text-2xl font-bold text-green-600'>
                    {isLoading ? <Skeleton className='h-8 w-8 mx-auto' /> : data.replicas.current}
                  </div>
                  <div className='text-sm text-green-600'>Current</div>
                </div>
                <div className='text-center p-4 bg-orange-50 rounded-lg'>
                  <div className='text-2xl font-bold text-orange-600'>
                    {isLoading ? <Skeleton className='h-8 w-8 mx-auto' /> : data.replicas.max}
                  </div>
                  <div className='text-sm text-orange-600'>Maximum</div>
                </div>
              </div>

              {/* Replica Instances */}
              <div className='border-t pt-6'>
                <h3 className='text-lg font-semibold text-foreground mb-4'>Replica Instances</h3>
                <div className='space-y-4'>
                  {isLoading ? (
                    // Show skeleton instances when loading
                    [...Array(3)].map((_, index) => (
                      <div key={`skeleton-instance-${index}`} className='border rounded-lg p-4'>
                        <div className='flex items-center justify-between mb-3'>
                          <div className='flex items-center gap-3'>
                            <div className='flex items-center gap-2'>
                              <Skeleton className='w-3 h-3 rounded-full' />
                              <Skeleton className='h-4 w-32' />
                            </div>
                            <Skeleton className='h-5 w-16 rounded-full' />
                          </div>
                          <Skeleton className='h-8 w-8' />
                        </div>
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                          <div>
                            <div className='text-muted-foreground'>Instance ID</div>
                            <Skeleton className='h-3 w-20 mt-1' />
                          </div>
                          <div>
                            <div className='text-muted-foreground'>CPU</div>
                            <Skeleton className='h-4 w-12 mt-1' />
                          </div>
                          <div>
                            <div className='text-muted-foreground'>Memory</div>
                            <Skeleton className='h-4 w-14 mt-1' />
                          </div>
                        </div>
                        <div className='mt-3'>
                          <Skeleton className='h-3 w-40' />
                        </div>
                      </div>
                    ))
                  ) : (
                    data.replicas.instances.map((instance: any) => (
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
                  )))}
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
          containerName={data.name}
          replicas={data.replicas.instances}
        />
      ),
    },
    {
      id: 'exec',
      label: 'Exec',
      icon: Terminal,
      content: (
        <ContainerExec
          containerName={data.name}
          replicas={data.replicas.instances}
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
      variant: data.status !== 'running' ? 'outline' : 'secondary',
    },
    {
      icon: Square,
      label: 'Stop',
      onClick: () => console.log('Stop'),
      variant: data.status !== 'stopped' ? 'outline' : 'secondary',
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
      title={data.name}
      description={`Container running ${data.image}`}
      icon={({ className }) => <ContainerImageIcon image={data.image} className={className} />}
      status={{
        label: data.status,
        className: getStatusColor(data.status),
      }}
      isLoading={isLoading}
      secondaryActions={secondaryActions}
      tabs={tabs}
      defaultTab='overview'
      breadcrumb={{
        items: [
          { label: 'Containers', href: '/containers' },
          { label: data.name },
        ],
      }}
    />
  )
}
