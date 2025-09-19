'use dom'

import { GenericResourceTableScreen, ResourceItem } from 'app/components/ctnr-io/generic-resource-table-screen.tsx'
import { TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { Route as RouteIcon, Container, ExternalLink } from 'lucide-react'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Label } from 'app/components/shadcn/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'app/components/shadcn/ui/select.tsx'
import { Checkbox } from 'app/components/shadcn/ui/checkbox.tsx'
import { useState } from 'react'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Route type definition
export interface RouteData extends ResourceItem {
  id: string
  name: string
  path: string
  targetService: string
  targetPort: number
  domain: string
  protocol: 'http' | 'https'
  status: 'active' | 'pending' | 'error'
  created: string
  methods: string[]
}

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

function getMethodColor(method: string) {
  switch (method) {
    case 'GET':
      return 'text-blue-600 bg-blue-50'
    case 'POST':
      return 'text-green-600 bg-green-50'
    case 'PUT':
      return 'text-orange-600 bg-orange-50'
    case 'DELETE':
      return 'text-red-600 bg-red-50'
    case 'PATCH':
      return 'text-purple-600 bg-purple-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

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
  onSubmit: (data: Omit<RouteData, 'id'>) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    path: '/',
    targetService: '',
    targetPort: 80,
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
    
    const selectedMethods = Object.entries(formData.methods)
      .filter(([, selected]) => selected)
      .map(([method]) => method)

    const routeData = {
      name: formData.name,
      path: formData.path,
      targetService: formData.targetService,
      targetPort: formData.targetPort,
      domain: formData.domain,
      protocol: formData.protocol,
      status: 'pending' as const,
      created: new Date().toISOString(),
      methods: selectedMethods,
    }

    await onSubmit(routeData)
  }

  const handleMethodChange = (method: string, checked: boolean) => {
    setFormData({
      ...formData,
      methods: {
        ...formData.methods,
        [method]: checked,
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="route-name">Route Name</Label>
        <Input
          id="route-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., api-route"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="route-path">Path</Label>
        <Input
          id="route-path"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          placeholder="e.g., /api or /webhooks/github"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="domain">Domain</Label>
        <Input
          id="domain"
          value={formData.domain}
          onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
          placeholder="e.g., app.example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="protocol">Protocol</Label>
        <Select
          value={formData.protocol}
          onValueChange={(value) => setFormData({ ...formData, protocol: value as 'http' | 'https' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="https">HTTPS</SelectItem>
            <SelectItem value="http">HTTP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="target-service">Target Service</Label>
        <Input
          id="target-service"
          value={formData.targetService}
          onChange={(e) => setFormData({ ...formData, targetService: e.target.value })}
          placeholder="e.g., api-server"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="target-port">Target Port</Label>
        <Input
          id="target-port"
          type="number"
          min="1"
          max="65535"
          value={formData.targetPort}
          onChange={(e) => setFormData({ ...formData, targetPort: parseInt(e.target.value) || 80 })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>HTTP Methods</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(formData.methods).map(([method, checked]) => (
            <div key={method} className="flex items-center space-x-2">
              <Checkbox
                id={`method-${method}`}
                checked={checked}
                onCheckedChange={(checked) => handleMethodChange(method, !!checked)}
              />
              <Label htmlFor={`method-${method}`} className="text-sm font-mono">
                {method}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
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
  const routeData: RouteData[] = Array.isArray(routes) ? routes.map((route: any) => ({
    id: route.id,
    name: route.name,
    path: route.path,
    targetService: route.targetService,
    targetPort: route.targetPort,
    domain: route.domain,
    protocol: route.protocol as 'http' | 'https',
    status: route.status as 'active' | 'pending' | 'error',
    created: route.created,
    methods: route.methods,
  })) : []

  const handleAdd = async (routeForm: Omit<RouteData, 'id'>) => {
    await createRoute.mutateAsync({
      name: routeForm.name,
      path: routeForm.path,
      targetService: routeForm.targetService,
      targetPort: routeForm.targetPort,
      domain: routeForm.domain,
      protocol: routeForm.protocol,
      methods: routeForm.methods,
      cluster: 'eu' as 'eu' | 'eu-0' | 'eu-1' | 'eu-2',
    })
  }

  const handleDelete = async (route: RouteData) => {
    await deleteRoute.mutateAsync({
      name: route.name,
      cluster: 'eu' as 'eu' | 'eu-0' | 'eu-1' | 'eu-2',
    })
  }

  const handleRowClick = (route: RouteData) => {
    // TODO: Navigate to route details or edit page
    console.log('Route clicked:', route)
  }
  // Define table columns
  const columns: TableColumn<RouteData>[] = [
    {
      key: 'name',
      label: 'Route',
      render: (value, item) => (
        <div className="flex items-center gap-2">
          <RouteIcon className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-medium">{value}</span>
            <code className="text-xs text-muted-foreground">{item.path}</code>
          </div>
        </div>
      ),
      className: 'font-semibold',
      visibleOnMobile: true,
    },
    {
      key: 'domain',
      label: 'Domain',
      render: (value, item) => (
        <div className="flex items-center gap-1">
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{item.protocol}://{value}</span>
        </div>
      ),
      className: 'text-sm',
      visibleOnMobile: true,
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge variant="secondary" className={getStatusColor(value)}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      ),
      className: 'text-sm',
      visibleOnMobile: true,
    },
    {
      key: 'methods',
      label: 'Methods',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((method) => (
            <Badge
              key={method}
              variant="outline"
              className={`text-xs ${getMethodColor(method)}`}
            >
              {method}
            </Badge>
          ))}
          {value.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{value.length - 3} more
            </span>
          )}
        </div>
      ),
      className: 'text-sm',
    },
    {
      key: 'targetService',
      label: 'Target Service',
      render: (value, item) => (
        <div className="flex items-center gap-1">
          <Container className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm">{value}:{item.targetPort}</span>
        </div>
      ),
      className: 'text-sm',
    },
    {
      key: 'created',
      label: 'Created',
      render: (value) => formatDate(value),
      className: 'text-sm text-muted-foreground',
    },
  ]

  return (
    <GenericResourceTableScreen
      resourceName="Route"
      resourceNamePlural="Routes"
      icon={RouteIcon}
      data={routeData}
      isLoading={isLoading}
      columns={columns}
      onAdd={handleAdd}
      onDelete={handleDelete}
      onRowClick={handleRowClick}
      addFormComponent={AddRouteForm}
      description="Manage HTTP routes and traffic routing rules"
      infoDescription="Configure HTTP routes to direct traffic from domains to your services. Set up path-based routing, method filtering, and load balancing rules."
      searchPlaceholder="Search routes by name, path, domain, or service..."
      searchKeys={['name', 'path', 'domain', 'targetService', 'status']}
      addButtonLabel="Create Route"
      mobileCardSubtitle={(item) => `${item.protocol}://${item.domain}${item.path}`}
      mobileCardStatus={(item) => ({
        label: item.status,
        className: getStatusColor(item.status),
      })}
      mobileCardIcon={(_item) => <RouteIcon className="h-4 w-4" />}
    />
  )
}