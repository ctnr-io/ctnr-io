'use dom'

import { GenericResourceTableScreen, ResourceItem } from 'app/components/ctnr-io/generic-resource-table-screen.tsx'
import { TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { Container, HardDrive } from 'lucide-react'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Label } from 'app/components/shadcn/ui/label.tsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'app/components/shadcn/ui/select.tsx'
import { useState } from 'react'
import { useTRPC } from 'driver/trpc/client/expo/mod.tsx'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Volume type definition
export interface VolumeData extends ResourceItem {
  id: string
  name: string
  size: string
  mountPath: string
  status: 'mounted' | 'available' | 'error'
  created: string
  attachedTo: string[] // Changed from string | null to string[] for multiple containers
}

function getStatusColor(status: string) {
  switch (status) {
    case 'mounted':
      return 'text-chart-2 bg-chart-2/10'
    case 'available':
      return 'text-chart-1 bg-chart-1/10'
    case 'error':
      return 'text-destructive bg-destructive/10'
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Add Volume Form Component
function AddVolumeForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: Omit<VolumeData, 'id'>) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
}) {
  const [formData, setFormData] = useState({
    name: '',
    size: '10',
    sizeUnit: 'GB',
    mountPath: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const volumeData = {
      name: formData.name,
      size: `${formData.size}${formData.sizeUnit}`,
      mountPath: formData.mountPath,
      status: 'available' as const,
      created: new Date().toISOString(),
      attachedTo: [] as string[], // Empty array for new volumes
    }

    await onSubmit(volumeData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="volume-name">Volume Name</Label>
        <Input
          id="volume-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., app-data"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="volume-size">Size</Label>
          <Input
            id="volume-size"
            type="number"
            min="1"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="size-unit">Unit</Label>
          <Select
            value={formData.sizeUnit}
            onValueChange={(value) => setFormData({ ...formData, sizeUnit: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GB">GB</SelectItem>
              <SelectItem value="TB">TB</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mount-path">Mount Path</Label>
        <Input
          id="mount-path"
          value={formData.mountPath}
          onChange={(e) => setFormData({ ...formData, mountPath: e.target.value })}
          placeholder="e.g., /app/data"
          required
        />
      </div>

      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
        <strong>Note:</strong> Volumes are created with ReadWriteMany access mode, 
        allowing them to be attached to multiple containers simultaneously.
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Volume'}
        </Button>
      </div>
    </form>
  )
}

export default function VolumesTableScreen() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  // Fetch volumes data
  const { data: volumes, isLoading } = useQuery(
    trpc.storage.volumes.list.queryOptions({
      output: 'raw',
    }),
  )

  // Create volume mutation
  const createVolume = useMutation(
    trpc.storage.volumes.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.storage.volumes.list.queryKey(),
        })
      },
    }),
  )

  // Delete volume mutation
  const deleteVolume = useMutation(
    trpc.storage.volumes.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.storage.volumes.list.queryKey(),
        })
      },
    }),
  )

  // Transform API data to component format
  const volumeData: VolumeData[] = Array.isArray(volumes) ? volumes.map((volume: any) => ({
    id: volume.id,
    name: volume.name,
    size: volume.size,
    mountPath: volume.mountPath,
    status: volume.status as 'mounted' | 'available' | 'error',
    created: volume.created,
    attachedTo: volume.attachedTo,
  })) : []

  const handleAdd = async (volumeForm: Omit<VolumeData, 'id'>) => {
    await createVolume.mutateAsync({
      name: volumeForm.name,
      size: volumeForm.size,
      mountPath: volumeForm.mountPath,
    })
  }

  const handleDelete = async (volume: VolumeData) => {
    await deleteVolume.mutateAsync({
      name: volume.name,
      cluster: 'eu' as 'eu' | 'eu-0' | 'eu-1' | 'eu-2',
      force: false,
    })
  }

  const handleRowClick = (volume: VolumeData) => {
    // TODO: Navigate to volume details or edit page
    console.log('Volume clicked:', volume)
  }
  // Define table columns
  const columns: TableColumn<VolumeData>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (value) => (
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{value}</span>
        </div>
      ),
      className: 'font-semibold',
      visibleOnMobile: true,
    },
    {
      key: 'size',
      label: 'Size',
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
      key: 'mountPath',
      label: 'Mount Path',
      render: (value) => (
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
          {value}
        </code>
      ),
      className: 'text-sm',
    },
    {
      key: 'attachedTo',
      label: 'Attached To',
      render: (value: string[]) => {
        if (!value || value.length === 0) {
          return <span className="text-muted-foreground text-sm">None</span>
        }
        
        if (value.length === 1) {
          return (
            <div className="flex items-center gap-1">
              <Container className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{value[0]}</span>
            </div>
          )
        }
        
        // Multiple containers
        return (
          <div className="flex items-center gap-1">
            <Container className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{value.length} containers</span>
            <div className="hidden lg:inline text-xs text-muted-foreground">
              ({value.join(', ')})
            </div>
          </div>
        )
      },
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
      resourceName="Volume"
      resourceNamePlural="Volumes"
      icon={HardDrive}
      data={volumeData}
      isLoading={isLoading}
      columns={columns}
      onAdd={handleAdd}
      onDelete={handleDelete}
      onRowClick={handleRowClick}
      addFormComponent={AddVolumeForm}
      description="Manage your persistent storage volumes"
      infoDescription="Create and manage storage volumes for your containers. Volumes use ReadWriteMany access mode, allowing them to be attached to multiple containers simultaneously for shared data access."
      searchPlaceholder="Search volumes by name, status, or mount path..."
      searchKeys={['name', 'status', 'mountPath', 'attachedTo']}
      addButtonLabel="Create Volume"
      mobileCardSubtitle={(item) => `${item.size} • ${item.status}`}
      mobileCardStatus={(item) => ({
        label: item.status,
        className: getStatusColor(item.status),
      })}
      mobileCardIcon={(_item) => <HardDrive className="h-4 w-4" />}
    />
  )
}
