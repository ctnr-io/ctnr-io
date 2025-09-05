'use dom'

import { ContainerExec } from 'app/components/ctnr-io/container-exec.tsx'
import { ContainerImageIcon } from 'app/components/ctnr-io/container-image-icon.tsx'
import { ContainerLogs } from 'app/components/ctnr-io/container-logs.tsx'
import { Copy, FileText, Info, Play, RotateCcw, Settings, Square, Terminal, Trash2 } from 'lucide-react'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'app/components/shadcn/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'app/components/shadcn/ui/tabs.tsx'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'

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

export function ContainersDetailScreen(props: {
  data: ContainerData
  isLoading: boolean
}) {
  const { isLoading } = props

  // Create skeleton data for loading state
  const data = isLoading
    ? {
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
        instances: [],
      },
      routes: [],
      clusters: [],
      restartPolicy: '',
      command: [],
      workingDir: '',
      environment: {},
      volumes: [],
      networks: [],
    }
    : props.data

  if (isLoading) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='container mx-auto px-6 py-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-foreground mb-2'>Container Details</h1>
            <p className='text-muted-foreground'>Loading container information...</p>
          </div>
          <div className='flex items-center justify-center py-20'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
              <p className='text-muted-foreground text-lg'>Loading container details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-6 py-8'>
        <div className='mb-8 flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-3 mb-2'>
              <ContainerImageIcon image={data.image} className='h-8 w-8' />
              <h1 className='text-3xl font-bold text-foreground'>{data.name}</h1>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(data.status)}`}
              >
                {data.status}
              </span>
            </div>
            <p className='text-muted-foreground'>Container running {data.image}</p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant={data.status !== 'running' ? 'outline' : 'secondary'}
              size='sm'
              onClick={() => console.log('Start')}
            >
              <Play className='h-4 w-4 mr-2' />
              Start
            </Button>
            <Button
              variant={data.status !== 'stopped' ? 'outline' : 'secondary'}
              size='sm'
              onClick={() => console.log('Stop')}
            >
              <Square className='h-4 w-4 mr-2' />
              Stop
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => console.log('Restart container')}
            >
              <RotateCcw className='h-4 w-4 mr-2' />
              Restart
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => console.log('Delete container')}
              className='text-destructive hover:text-destructive'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Delete
            </Button>
          </div>
        </div>

        <Tabs defaultValue='overview' className='space-y-6'>
          <TabsList className='grid w-full grid-cols-4'>
            <TabsTrigger value='overview' className='text-sm font-medium'>
              <Info className='h-4 w-4 mr-2' />
              Overview
            </TabsTrigger>
            <TabsTrigger value='config' className='text-sm font-medium'>
              <Settings className='h-4 w-4 mr-2' />
              Configuration
            </TabsTrigger>
            <TabsTrigger value='logs' className='text-sm font-medium'>
              <FileText className='h-4 w-4 mr-2' />
              Logs
            </TabsTrigger>
            <TabsTrigger value='exec' className='text-sm font-medium'>
              <Terminal className='h-4 w-4 mr-2' />
              Exec
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value='overview' className='space-y-6'>
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className='text-foreground'>Basic Information</CardTitle>
                <CardDescription>
                  Core container details and configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                    <span className='text-foreground font-medium'>Image</span>
                    <Badge variant="outline" className='font-mono'>{data.image}</Badge>
                  </div>
                  <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                    <span className='text-foreground font-medium'>Created</span>
                    <Badge variant="outline">{data.createdAt ? formatDate(data.createdAt.toISOString()) : 'Unknown'}</Badge>
                  </div>
                  <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                    <span className='text-foreground font-medium'>Restart Policy</span>
                    <Badge variant="outline">{data.restartPolicy || 'unless-stopped'}</Badge>
                  </div>
                  <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                    <span className='text-foreground font-medium'>Working Directory</span>
                    <Badge variant="outline" className='font-mono'>{data.workingDir || 'N/A'}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Runtime Information */}
            <Card>
              <CardHeader>
                <CardTitle className='text-foreground'>Runtime Information</CardTitle>
                <CardDescription>
                  Current resource usage and runtime details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                    <span className='text-foreground font-medium'>CPU Usage</span>
                    <Badge variant="outline" className='font-mono'>{data.cpu}</Badge>
                  </div>
                  <div className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                    <span className='text-foreground font-medium'>Memory Usage</span>
                    <Badge variant="outline" className='font-mono'>{data.memory}</Badge>
                  </div>
                </div>
                
                {/* Ports */}
                {data.ports && data.ports.length > 0 && (
                  <div className='mt-4'>
                    <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2'>Port Mappings</h4>
                    <div className='space-y-1'>
                      {data.ports.map((port, index) => (
                        <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                          {port}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Routes */}
                {data.routes && data.routes.length > 0 && (
                  <div className='mt-4'>
                    <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2'>Routes</h4>
                    <div className='space-y-1'>
                      {data.routes.map((route, index) => (
                        <div key={index} className='flex items-center gap-2'>
                          <a
                            href={route}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-primary hover:text-primary/80 underline text-sm font-mono bg-muted px-2 py-1 rounded'
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
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Replica Instances */}
            <Card>
              <CardHeader>
                <CardTitle className='text-foreground'>Replica Instances</CardTitle>
                <CardDescription>
                  Detailed information about each container instance
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              getStatusColor(instance.status)
                            }`}
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value='config' className='space-y-6'>
            {/* Environment Variables */}
            <Card>
              <CardHeader>
                <CardTitle className='text-foreground'>Environment Variables</CardTitle>
                <CardDescription>
                  Environment variables configured for this container
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-1 gap-4'>
                  {Object.entries(data.environment).map(([key, value]) => (
                    <div key={key} className='flex justify-between items-center p-3 bg-muted rounded-lg'>
                      <span className='text-foreground font-medium font-mono'>{key}</span>
                      <div className='flex items-center gap-2'>
                        <Badge variant="outline" className='font-mono'>{value}</Badge>
                        <button
                          type='button'
                          onClick={() => navigator.clipboard.writeText(value)}
                          className='p-1 hover:bg-muted rounded'
                          title='Copy value'
                        >
                          <Copy className='h-3 w-3' />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Storage & Networking */}
            <Card>
              <CardHeader>
                <CardTitle className='text-foreground'>Storage & Networking</CardTitle>
                <CardDescription>
                  Volume mounts and network configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Volumes */}
                {data.volumes && data.volumes.length > 0 && (
                  <div className='mb-4'>
                    <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2'>Volume Mounts</h4>
                    <div className='space-y-1'>
                      {data.volumes.map((volume, index) => (
                        <div key={index} className='font-mono text-sm bg-muted px-2 py-1 rounded'>
                          {volume}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value='logs'>
            <ContainerLogs
              containerName={data.name}
              replicas={data.replicas.instances}
            />
          </TabsContent>

          {/* Exec Tab */}
          <TabsContent value='exec'>
            <ContainerExec
              containerName={data.name}
              replicas={data.replicas.instances}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
