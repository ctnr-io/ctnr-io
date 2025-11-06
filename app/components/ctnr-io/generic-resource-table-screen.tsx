'use dom'

import { DataTableScreen, TableAction, TableColumn } from 'app/components/ctnr-io/data-table-screen.tsx'
import { LucideIcon, Plus, Trash2 } from 'lucide-react'
import { ReactNode, useCallback, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '../shadcn/ui/dialog.tsx'
import { Button } from '../shadcn/ui/button.tsx'

export interface ResourceItem {
  id: string
  name: string
  [key: string]: any
}

export interface GenericResourceTableScreenProps<T extends ResourceItem> {
  // Resource identification
  resourceName: string
  resourceNamePlural: string
  icon: LucideIcon

  // Data and loading
  data: T[]
  isLoading?: boolean

  // Table configuration
  columns: TableColumn<T>[]

  // CRUD operations
  onAdd?: (item: Omit<T, 'id'>) => Promise<void>
  onDelete?: (item: T) => Promise<void>
  onRowClick?: (item: T) => void

  // Form configuration
  addFormComponent?: React.ComponentType<{
    onSubmit: (data: Omit<T, 'id'>) => Promise<void>
    onCancel: () => void
    isSubmitting: boolean
  }>

  // UI customization
  description?: string
  infoDescription?: string
  searchPlaceholder?: string
  searchKeys?: string[]
  emptyMessage?: string
  addButtonLabel?: string
  tableDescription?: string
  mobileCardTitle?: (item: T) => string
  mobileCardSubtitle?: (item: T) => string
  mobileCardStatus?: (item: T) => { label: string; className: string }
  mobileCardIcon?: (item: T) => ReactNode
}

function DefaultConfirmDeleteDialog<T extends ResourceItem>({
  item,
  resourceName,
  onConfirm,
  isDeleting,
  children,
}: {
  item: T
  resourceName: string
  onConfirm: (item: T) => Promise<void>
  isDeleting: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  const handleConfirm = async () => {
    await onConfirm(item)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete {resourceName}</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete "{item.name}"? This action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant='outline' disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant='destructive'
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GenericResourceTableScreen<T extends ResourceItem>({
  resourceName,
  resourceNamePlural,
  icon: Icon,
  data,
  isLoading = false,
  columns,
  onAdd,
  onDelete,
  onRowClick,
  addFormComponent: AddFormComponent,
  description,
  infoDescription,
  searchPlaceholder,
  searchKeys,
  emptyMessage,
  addButtonLabel,
  tableDescription,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardStatus,
  mobileCardIcon,
}: GenericResourceTableScreenProps<T>) {
  const [isDeletingItem, setIsDeletingItem] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [isAddingItem, setIsAddingItem] = useState(false)

  // Handle add item
  const handleAddItem = async (data: Omit<T, 'id'>) => {
    if (!onAdd) return
    setIsAddingItem(true)
    try {
      await onAdd(data)
      setAddDialogOpen(false)
    } finally {
      setIsAddingItem(false)
    }
  }

  // Build actions array
  const actions: TableAction<T>[] = []

  if (onDelete) {
    actions.push({
      icon: Trash2,
      label: `Delete ${resourceName}`,
      variant: 'ghost',
      className: 'text-destructive hover:text-destructive',
      disabled: isDeletingItem !== null,
      Wrapper: useCallback(({ item, children }: { item: T; children: ReactNode }) => (
        <DefaultConfirmDeleteDialog
          item={item}
          resourceName={resourceName}
          onConfirm={async (item) => {
            setIsDeletingItem(item.id)
            try {
              await onDelete(item)
            } finally {
              setIsDeletingItem(null)
            }
          }}
          isDeleting={isDeletingItem === item.id}
        >
          {children}
        </DefaultConfirmDeleteDialog>
      ), [isDeletingItem, onDelete, resourceName]),
    })
  }

  // Build primary action
  const primaryAction = onAdd
    ? {
      label: addButtonLabel || `Add ${resourceName}`,
      icon: Plus,
      onClick: () => setAddDialogOpen(true),
    }
    : undefined

  return (
    <>
      <DataTableScreen
        title={resourceNamePlural}
        description={description || `Manage your ${resourceNamePlural.toLowerCase()}`}
        icon={Icon}
        primaryAction={primaryAction}
        infoDescription={infoDescription}
        data={data}
        columns={columns}
        actions={actions}
        tableTitle={`All ${resourceNamePlural}`}
        tableDescription={tableDescription || `${data.length} ${resourceNamePlural.toLowerCase()} total`}
        mobileCardTitle={mobileCardTitle || ((item) => item.name)}
        mobileCardSubtitle={mobileCardSubtitle}
        mobileCardStatus={mobileCardStatus}
        mobileCardIcon={mobileCardIcon}
        onRowClick={onRowClick}
        rowClickable={!!onRowClick}
        searchable={!!searchKeys?.length}
        searchPlaceholder={searchPlaceholder || `Search ${resourceNamePlural.toLowerCase()}...`}
        searchKeys={searchKeys}
        columnFilterable
        defaultVisibleColumns={columns.map((col) => col.key)}
        emptyMessage={emptyMessage ||
          `No ${resourceNamePlural.toLowerCase()} found. Create your first ${resourceName.toLowerCase()} to get started.`}
        loading={isLoading}
      />

      {/* Add dialog */}
      {onAdd && AddFormComponent && (
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogTitle>Add {resourceName}</DialogTitle>
            <AddFormComponent
              onSubmit={handleAddItem}
              onCancel={() => setAddDialogOpen(false)}
              isSubmitting={isAddingItem}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
