'use dom'

import { GenericResourceTableScreen } from 'app/components/ctnr-io/generic-resource-table-screen.tsx'
import { TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { ExternalLink, Route as RouteIcon } from 'lucide-react'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Label } from 'app/components/shadcn/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'app/components/shadcn/ui/select.tsx'
// Checkbox import removed as not used in this form
import { useState } from 'react'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Route } from 'core/schemas/network/route.ts'

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'text-chart-2 bg-chart-2/10'
    case 'pending':
      return 'text-chart-4 bg-chart-4/10'
    case 'error':
      return 'text-destructive bg-destructive/10'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

// Method color mapping no longer used in UI but kept for future use

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Add Route Form Component
function AddRouteForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: Omit<Route, 'id'>) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    path: '/',
    container: '',
  port: '80',
  domain: '',
  selectedDomain: '',
    subdomain: '',
    protocol: 'https' as 'http' | 'https',
    methods: {
      GET: true,
      POST: false,
      PUT: false,
      DELETE: false,
      PATCH: false,
    },
  })

  const trpc = useTRPC()

  // Fetch domains and containers for selects
  const { data: domainsRaw } = useQuery(
    trpc.network.domains.list.queryOptions({ output: 'raw' }),
  )

  const { data: containersRaw } = useQuery(
    trpc.core.listQuery.queryOptions({
      output: 'raw',
      fields: ['basic', 'resources', 'routes', 'replicas', 'clusters'],
    }),
  )

  const domains = Array.isArray(domainsRaw)
    ? domainsRaw.map((d: any) => ({ name: d.name, verification: d.verification, status: d.status }))
    : []

  const containers = Array.isArray(containersRaw)
    ? containersRaw.map((c: any) => ({ name: c.name, ports: (c.ports || []), labels: (c.labels || {}) }))
    : []

  function getPortsForContainer(containerName: string): Array<{ name: string; number: number }> {
    const container = containers.find((c) => c.name === containerName)
    return container?.ports ?? []
  }

  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formData.container) {
      setFormError('Target container is required')
      return
    }
    if (!formData.port) {
      setFormError('Target port is required')
      return
    }
    const fullDomain = formData.subdomain
      ? `${formData.subdomain}.${formData.domain}`
      : formData.domain

    const routeData = {
      name: formData.name,
      path: formData.path,
      container: formData.container,
      port: formData.port,
  // If fullDomain is an empty string, pass an empty string (API accepts it as 'no domain')
  domain: fullDomain || '',
      protocol: formData.protocol,
      status: 'pending' as const,
      createdAt: new Date(),
    }

    await onSubmit(routeData)
  }

  // Helper to determine form validity for disabling submit button
  // const isFormInvalid = !formData.container || !formData.port

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='route-name'>Route Name</Label>
        <Input
          id='route-name'
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder='e.g., api-route'
          required
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='route-path'>Path</Label>
        <Input
          id='route-path'
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          placeholder='e.g., /api or /webhooks/github'
          required
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='domain'>Domain</Label>
        <div className='flex gap-2 items-center'>
          <Input
            id='subdomain'
            value={formData.subdomain}
            onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
            placeholder='Subdomain (optional) e.g., api or www'
            className='w-1/3'
            disabled={!formData.domain}
          />
        <Select
          value={formData.selectedDomain}
          onValueChange={(value) => {
            const NO_DOMAIN = '__no_domain__'
            const domainValue = value === NO_DOMAIN ? '' : value
            setFormData({ ...formData, selectedDomain: value, domain: domainValue, subdomain: domainValue ? formData.subdomain : '' })
          }}
        >
          <SelectTrigger className='w-full'>
            <SelectValue placeholder='Select domain...' />
          </SelectTrigger>
          <SelectContent className='w-full min-w-full'>
            <SelectItem value='__no_domain__'>No domain (auto-generated)</SelectItem>
            {domains.map((d) => {
              const verified = d.status === 'verified'
              return (
                <SelectItem key={d.name} value={d.name} disabled={!verified}>
                  {d.name}
                  {!verified ? ' (pending verification)' : ''}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        </div>

        {formData.domain ? (
          <div className='text-sm text-muted-foreground mt-1'>
            Preview: {formData.subdomain ? `${formData.subdomain}.${formData.domain}` : formData.domain}
          </div>
        ) : (
          <div className='text-sm text-muted-foreground mt-1'>
            Preview: Auto-generated ctnr.io hostname
          </div>
        )}
      </div>

      <div className='space-y-2'>
        <Label htmlFor='protocol'>Protocol</Label>
        <Select
          value={formData.protocol}
          onValueChange={(value) => setFormData({ ...formData, protocol: value as 'http' | 'https' })}
        >
          <SelectTrigger className='w-full'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className='w-full min-w-full'>
            <SelectItem value='https'>HTTPS</SelectItem>
            <SelectItem value='http'>HTTP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-[1fr,160px] gap-2'>
        <div className='space-y-2'>
          <Label htmlFor='target-container'>Target Container</Label>
          <Select
            value={formData.container}
            onValueChange={(value) => {
              // when container changes, reset port to first available port if present
              const ports = getPortsForContainer(value)
              const port = ports && ports.length > 0 ? String(ports[0].number ?? ports[0]) : formData.port
              setFormData({ ...formData, container: value, port })
            }}
            required
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select container...' />
            </SelectTrigger>
            <SelectContent className='w-full min-w-full'>
              {containers.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='target-port'>Target Port</Label>
          <Select
            value={formData.port}
            onValueChange={(value) => setFormData({ ...formData, port: value })}
            required
            disabled={!formData.container}
          >
            <SelectTrigger className='w-full'>
              <SelectValue placeholder='Select port...' />
            </SelectTrigger>
            <SelectContent className='w-full min-w-full'>
              {getPortsForContainer(formData.container).length === 0 && (
                <SelectItem value={formData.port}>{formData.port}</SelectItem>
              )}
              {getPortsForContainer(formData.container).map((p) => (
                <SelectItem key={p.number} value={String(p.number)}>
                  {p.name ? `${p.name}:` : ''}{p.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='flex justify-end gap-2 pt-4'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type='submit' disabled={isSubmitting || !formData.container || !formData.port}>
          {isSubmitting ? 'Creating...' : 'Create Route'}
        </Button>
      </div>
      {formError && (
        <div className='text-sm text-destructive mt-2'>
          {formError}
        </div>
      )}
    </form>
  )
}

export default function RoutesTableScreen() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Fetch routes data
  const { data: routes, isLoading } = useQuery(
    trpc.network.routes.list.queryOptions({
      output: 'raw',
    }),
  )

  // Create route mutation
  const createRoute = useMutation(
    trpc.network.routes.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.network.routes.list.queryKey(),
        })
      },
    }),
  )

  // Delete route mutation
  const deleteRoute = useMutation(
    trpc.network.routes.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.network.routes.list.queryKey(),
        })
      },
    }),
  )

  // Transform API data to component format
  const routeData: Route[] = Array.isArray(routes)
    ? routes.map((route: any) => ({
      id: route.id,
      name: route.name,
      domain: route.domain,
      path: route.path ?? '/',
      port: route.port,
      protocol: route.protocol as 'http' | 'https',
      status: route.status as 'active' | 'pending' | 'error',
      container: route.container,
      createdAt: route.createdAt ? new Date(route.createdAt) : new Date(),
    }))
    : []

  const handleAdd = async (routeForm: Omit<Route, 'id'>) => {
    await createRoute.mutateAsync({
      name: routeForm.name,
      container: routeForm.container,
      domain: routeForm.domain,
      port: routeForm.port,
      path: routeForm.path,
      protocol: routeForm.protocol as 'http' | 'https',
    })
  }

  const handleDelete = async (route: Route) => {
    await deleteRoute.mutateAsync({
      name: route.name,
    })
  }

  const handleRowClick = (route: Route) => {
    // Open in new tab
    globalThis.window.open(`${route.protocol}://${route.domain}${route.path}`, '_blank')
  }
  // Define table columns
  const columns: TableColumn<Route>[] = [
    {
      key: 'name',
      label: 'Route',
      render: (value) => (
        <div className='flex items-center gap-2'>
          <ExternalLink className='h-3 w-3 text-muted-foreground' />
          <div className='flex flex-col'>
            <span className='font-medium'>{value}</span>
          </div>
        </div>
      ),
      className: 'font-semibold',
      visibleOnMobile: true,
    },
    {
      key: 'protocol',
      label: 'Protocol',
      render: (value) => (
        <span className='text-xs font-mono'>{value?.toUpperCase?.() ?? String(value).toUpperCase()}</span>
      ),
      className: 'text-sm',
    },
    {
      key: 'domain',
      label: 'Domain',
      render: (value, _item) => (
        <div className='flex items-center gap-1'>
          <span className='text-sm'>{value}</span>
        </div>
      ),
      className: 'text-sm',
      visibleOnMobile: true,
    },
    {
      key: 'path',
      label: 'Path',
      render: (value) => <span className='text-xs font-mono'>{value || '/'}</span>,
      className: 'text-sm',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant='secondary' className={getStatusColor(value)}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      ),
      className: 'text-sm',
      visibleOnMobile: true,
    },
    {
      key: 'container',
      label: 'Container',
      render: (value) => <span className='text-xs font-mono'>{value}</span>,
      className: 'text-sm',
    },
    {
      key: 'port',
      label: 'Port',
      render: (value) => <span className='text-xs font-mono'>{value}</span>,
      className: 'text-sm',
    },

    {
      key: 'createdAt',
      label: 'Created',
      render: (value) => formatDate(value),
      className: 'text-sm text-muted-foreground',
    },
  ]

  return (
    <GenericResourceTableScreen
      resourceName='Route'
      resourceNamePlural='Routes'
      icon={RouteIcon}
      data={routeData}
      isLoading={isLoading}
      columns={columns}
      onAdd={handleAdd}
      onDelete={handleDelete}
      onRowClick={handleRowClick}
      addFormComponent={AddRouteForm}
      description='Manage HTTP routes and traffic routing rules'
      infoDescription='Configure HTTP routes to direct traffic from domains to your services. Set up path-based routing, method filtering, and load balancing rules.'
      searchPlaceholder='Search routes by name, path, domain, or service...'
      searchKeys={['name', 'path', 'domain', 'container', 'status']}
      addButtonLabel='Create Route'
      mobileCardSubtitle={(item) => `${item.protocol}://${item.domain}${item.path}`}
      mobileCardStatus={(item) => ({
        label: item.status,
        className: getStatusColor(item.status),
      })}
      mobileCardIcon={(_item) => <RouteIcon className='h-4 w-4' />}
    />
  )
}
