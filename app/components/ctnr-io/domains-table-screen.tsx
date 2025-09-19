'use dom'

import { GenericResourceTableScreen } from 'app/components/ctnr-io/generic-resource-table-screen.tsx'
import { TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { Globe, Shield, AlertTriangle, Clock } from 'lucide-react'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Label } from 'app/components/shadcn/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'app/components/shadcn/ui/select.tsx'
import { Checkbox } from 'app/components/shadcn/ui/checkbox.tsx'
import { useState } from 'react'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Domain type definition for frontend - only custom domains
interface DomainData {
  id: string
  name: string
  status: 'active' | 'pending' | 'error' | 'expired'
  type: 'custom' // Only custom domains are supported
  ssl: boolean
  created: string
  expiresAt: string | null
  provider: string
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'text-chart-2 bg-chart-2/10'
    case 'pending':
      return 'text-chart-4 bg-chart-4/10'
    case 'error':
      return 'text-destructive bg-destructive/10'
    case 'expired':
      return 'text-muted-foreground bg-muted'
    default:
      return 'text-muted-foreground bg-muted'
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Add Domain Form Component - only for custom domains
function AddDomainForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: Omit<DomainData, 'id'>) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    ssl: true,
    provider: 'Cloudflare',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const domainData = {
      name: formData.name,
      status: 'pending' as const,
      type: 'custom' as const,
      ssl: formData.ssl,
      created: new Date().toISOString(),
      expiresAt: null,
      provider: formData.provider,
    }

    await onSubmit(domainData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="domain-name">Domain Name</Label>
        <div className="flex items-center">
          <Input
            id="domain-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="example.com"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enter your custom domain name (e.g., example.com, app.mydomain.net)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="provider">DNS Provider</Label>
        <Select
          value={formData.provider}
          onValueChange={(value) => setFormData({ ...formData, provider: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cloudflare">Cloudflare</SelectItem>
            <SelectItem value="Route53">Amazon Route 53</SelectItem>
            <SelectItem value="DigitalOcean">DigitalOcean DNS</SelectItem>
            <SelectItem value="Google">Google Domains</SelectItem>
            <SelectItem value="Namecheap">Namecheap</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="ssl-enabled"
          checked={formData.ssl}
          onCheckedChange={(checked) => setFormData({ ...formData, ssl: !!checked })}
        />
        <Label htmlFor="ssl-enabled" className="text-sm">
          Enable SSL certificate (Let's Encrypt)
        </Label>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> After adding your domain, you'll need to configure DNS records
          to point to your ctnr.io cluster before the SSL certificate can be issued.
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Domain'}
        </Button>
      </div>
    </form>
  )
}

export default function DomainsTableScreen() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Fetch domains data
  const { data: domains, isLoading } = useQuery(
    trpc.network.domains.list.queryOptions({
      output: 'raw',
    }),
  )

  // Create domain mutation
  const createDomain = useMutation(
    trpc.network.domains.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.network.domains.list.queryKey(),
        })
      },
    }),
  )

  // Delete domain mutation
  const deleteDomain = useMutation(
    trpc.network.domains.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.network.domains.list.queryKey(),
        })
      },
    }),
  )

  // Transform API data to component format
  const domainData: DomainData[] = Array.isArray(domains) ? domains.map((domain: any) => ({
    id: domain.id,
    name: domain.name,
    status: domain.status as 'active' | 'pending' | 'error' | 'expired',
    type: 'custom' as const, // All domains are custom now
    ssl: domain.ssl,
    created: domain.created,
    expiresAt: domain.expiresAt,
    provider: domain.provider,
  })) : []

  const handleAdd = async (domainForm: Omit<DomainData, 'id'>) => {
    await createDomain.mutateAsync({
      name: domainForm.name,
      ssl: domainForm.ssl,
      provider: domainForm.provider,
    })
  }

  const handleDelete = async (domain: DomainData) => {
    await deleteDomain.mutateAsync({
      name: domain.name,
    })
  }

  const handleRowClick = (domain: DomainData) => {
    // Could navigate to domain details page
    console.log('Domain clicked:', domain.name)
  }

  // Table columns configuration
  const columns: TableColumn<DomainData>[] = [
    {
      key: 'name',
      label: 'Domain',
      render: (value: string, _item: DomainData) => (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{value}</span>
            <div className="text-xs text-muted-foreground">Custom Domain</div>
          </div>
        </div>
      ),
      className: 'text-sm',
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <Badge className={getStatusColor(value)}>
          {value === 'active' && <Shield className="h-3 w-3 mr-1" />}
          {value === 'pending' && <Clock className="h-3 w-3 mr-1" />}
          {value === 'error' && <AlertTriangle className="h-3 w-3 mr-1" />}
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      ),
      className: 'text-sm',
    },
    {
      key: 'ssl',
      label: 'SSL',
      render: (value: boolean) => (
        <Badge className={value ? 'text-chart-2 bg-chart-2/10' : 'text-muted-foreground bg-muted'}>
          {value ? '✓ Enabled' : '✗ Disabled'}
        </Badge>
      ),
      className: 'text-sm',
    },
    {
      key: 'provider',
      label: 'DNS Provider',
      render: (value: string) => (
        <span className="text-sm text-muted-foreground">{value}</span>
      ),
      className: 'text-sm',
    },
    {
      key: 'created',
      label: 'Created',
      render: (value: string) => (
        <span className="text-sm text-muted-foreground">{formatDate(value)}</span>
      ),
      className: 'text-sm',
    },
  ]

  return (
    <GenericResourceTableScreen
      resourceName="Domain"
      resourceNamePlural="Domains"
      icon={Globe}
      data={domainData}
      isLoading={isLoading}
      columns={columns}
      onAdd={handleAdd}
      onDelete={handleDelete}
      onRowClick={handleRowClick}
      addFormComponent={AddDomainForm}
      description="Manage your custom domains and SSL certificates"
      infoDescription="Add custom domains to use with your containers. Each domain will get an SSL certificate automatically provisioned via Let's Encrypt. You'll need to configure DNS records to point to your ctnr.io cluster."
      searchPlaceholder="Search domains by name, status, or provider..."
      searchKeys={['name', 'status', 'provider']}
      addButtonLabel="Add Domain"
      mobileCardSubtitle={(item) => `${item.provider} • ${item.status}`}
      mobileCardStatus={(item) => ({
        label: item.status,
        className: getStatusColor(item.status),
      })}
      mobileCardIcon={(_item) => <Globe className="h-4 w-4" />}
    />
  )
}