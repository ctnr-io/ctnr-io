'use dom'

import { GenericResourceTableScreen, ResourceItem } from 'app/components/ctnr-io/generic-resource-table-screen.tsx'
import { TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { AlertTriangle, Clock, Globe, Shield } from 'lucide-react'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Label } from 'app/components/shadcn/ui/label.tsx'
import { useState } from 'react'
import { useTRPC } from 'api/drivers/trpc/client/expo/mod.tsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Domain type definition for frontend - only custom domains
interface DomainData extends ResourceItem {
  createdAt?: string
  verification?: {
    type?: string
    name?: string
    value?: string
    status?: string
  }
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
  onSubmit: (data: Pick<DomainData, 'name'>) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const domainData = {
      name: formData.name,
    }

    await onSubmit(domainData)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='domain-name'>Domain Name</Label>
        <div className='flex items-center'>
          <Input
            id='domain-name'
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder='example.com'
            required
          />
        </div>
        <p className='text-xs text-muted-foreground'>
          Enter your custom domain name (e.g., example.com, app.mydomain.net)
        </p>
      </div>

      <div className='flex justify-end gap-2 pt-4'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type='submit' disabled={isSubmitting}>
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
  const domainData: DomainData[] = Array.isArray(domains)
    ? domains.map((domain: any) => ({
      id: domain.id,
      name: domain.name,
      status: domain.status as 'active' | 'pending' | 'error' | 'expired',
      createdAt: domain.createdAt ?? domain.created,
      verification: domain.verification ?? domain.verificationRecord,
      routeCount: domain.routes?.length ?? (domain.routeCount ?? 0),
    }))
    : []

  const handleAdd = async (domainForm: Omit<DomainData, 'id'>) => {
    await createDomain.mutateAsync({
      name: domainForm.name,
    })
  }

  const handleDelete = async (domain: DomainData) => {
    await deleteDomain.mutateAsync({
      name: domain.name,
    })
  }

  // Table columns configuration
  const columns: TableColumn<DomainData>[] = [
    {
      key: 'name',
      label: 'Domain',
      render: (value: string, _item: DomainData) => (
        <div className='flex items-center gap-2'>
          <Globe className='h-4 w-4 text-muted-foreground' />
          <div>
            <span className='font-medium'>{value}</span>
            <div className='text-xs text-muted-foreground'>Custom Domain</div>
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
          {value === 'active' && <Shield className='h-3 w-3 mr-1' />}
          {value === 'pending' && <Clock className='h-3 w-3 mr-1' />}
          {value === 'error' && <AlertTriangle className='h-3 w-3 mr-1' />}
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </Badge>
      ),
      className: 'text-sm',
    },
    {
      key: 'verification',
      label: 'Verification',
      render: (_value, item: DomainData) => {
        const verification = item.verification
        if (!verification || verification.status === 'verified' || verification.type !== 'TXT') {
          return <span className='text-sm text-muted-foreground'>-</span>
        }
        return (
          <div className='text-xs font-mono bg-muted p-2 rounded border overflow-x-scroll no-scrollbar'>
            <div className='grid grid-cols-5 gap-1 text-xs'>
              <div className='font-semibold'>Type:</div>
              <div className='col-span-4'>TXT</div>
              <div className='font-semibold'>Name:</div>
              <div className='col-span-4'>{verification.name}</div>
              <div className='font-semibold'>Value:</div>
              <div className='col-span-4'>{verification.value}</div>
            </div>
          </div>
        )
      },
      className: 'text-sm',
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (value: string) => <span className='text-sm text-muted-foreground'>{formatDate(value)}</span>,
      className: 'text-sm',
    },
  ]

  return (
    <GenericResourceTableScreen
      resourceName='Domain'
      resourceNamePlural='Domains'
      icon={Globe}
      data={domainData}
      isLoading={isLoading}
      columns={columns}
      onAdd={handleAdd}
      onDelete={handleDelete}
      addFormComponent={AddDomainForm}
      description='Manage your custom domains and SSL certificates'
      infoDescription="Add custom domains to use with your containers. Each domain will get an SSL certificate automatically provisioned via Let's Encrypt. You'll need to configure DNS records to point to your ctnr.io cluster."
      searchPlaceholder='Search domains by name, status, or provider...'
      searchKeys={['name', 'status', 'routeCount']}
      addButtonLabel='Add Domain'
      mobileCardSubtitle={(item) => `${item.name} • ${item.status}`}
      mobileCardStatus={(item) => ({
        label: item.status,
        className: getStatusColor(item.status),
      })}
      mobileCardIcon={(_item) => <Globe className='h-4 w-4' />}
    />
  )
}
