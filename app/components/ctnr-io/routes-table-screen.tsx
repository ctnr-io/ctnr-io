'use dom'

import { GenericResourceTableScreen } from 'app/components/ctnr-io/generic-resource-table-screen.tsx'
import { TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { ExternalLink, Route as RouteIcon } from 'lucide-react'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Label } from 'app/components/shadcn/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'app/components/shadcn/ui/select.tsx'
import { Checkbox } from 'app/components/shadcn/ui/checkbox.tsx'
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
    protocol: 'https' as 'http' | 'https',
    methods: {
      GET: true,
      POST: false,
      PUT: false,
      DELETE: false,
      PATCH: false,
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const routeData = {
      name: formData.name,
      path: formData.path,
      container: formData.container,
      port: formData.port,
      domain: formData.domain,
      protocol: formData.protocol,
      status: 'pending' as const,
      createdAt: new Date(),
    }

    await onSubmit(routeData)
  }

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
        <Input
          id='domain'
          value={formData.domain}
          onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
          placeholder='e.g., app.example.com'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='protocol'>Protocol</Label>
        <Select
          value={formData.protocol}
          onValueChange={(value) => setFormData({ ...formData, protocol: value as 'http' | 'https' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='https'>HTTPS</SelectItem>
            <SelectItem value='http'>HTTP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='target-service'>Target Service (Container)</Label>
        <Input
          id='target-service'
          value={formData.container}
          onChange={(e) => setFormData({ ...formData, container: e.target.value })}
          placeholder='e.g., api-server'
          required
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='target-port'>Target Port</Label>
        <Input
          id='target-port'
          value={formData.port}
          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
          required
        />
      </div>

      <div className='flex justify-end gap-2 pt-4'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Route'}
        </Button>
      </div>
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
      // Convert numeric port to array of strings as the API expects (names/numbers)
      port: routeForm.port ? [String(routeForm.port)] : undefined,
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
      render: (value, item) => (
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
