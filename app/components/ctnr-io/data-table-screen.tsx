'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'
import { Card } from '../shadcn/ui/card.tsx'
import { DataTable, TableColumn, TableAction } from './data-table.tsx'

export type { TableColumn, TableAction }


export interface DataTableScreenProps<T = any> {
  // Header props
  title: string
  description: string
  icon: LucideIcon

  // Action button props
  primaryAction?: {
    label: string
    icon: LucideIcon
    onClick: () => void
  }

  // Description section
  infoDescription?: ReactNode

  // Table props (passed to DataTable)
  data: T[]
  columns: TableColumn<T>[]
  actions?: TableAction<T>[]

  // Table header
  tableTitle: string
  tableDescription?: ReactNode

  // Mobile card customization
  mobileCardTitle: (item: T) => string
  mobileCardSubtitle?: (item: T) => string
  mobileCardStatus?: (item: T) => { label: string; className: string }
  mobileCardIcon?: (item: T) => ReactNode // Custom icon renderer for mobile cards

  // Row/Card click functionality
  onRowClick?: (item: T) => void
  rowClickable?: boolean

  // Search functionality
  searchable?: boolean
  searchPlaceholder?: string
  searchKeys?: (keyof T)[] // Keys to search in

  // Column filtering
  columnFilterable?: boolean
  defaultVisibleColumns?: string[] // Column keys that should be visible by default
  mobileVisibleColumns?: string[] // Column keys that should be visible on mobile

  // Loading and empty states
  loading?: boolean
  emptyMessage?: string

  pagination?: boolean
  page?: number // Current page number (0-indexed)
  onPageChange?: (newPage: number) => void
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

export function DataTableScreen<T = any>({
  title,
  description,
  icon: Icon,
  primaryAction,
  infoDescription,
  data,
  columns,
  actions = [],
  tableTitle,
  tableDescription,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardStatus,
  mobileCardIcon,
  onRowClick,
  rowClickable = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys,
  columnFilterable = false,
  defaultVisibleColumns,
  mobileVisibleColumns,
  loading = false,
  emptyMessage = 'No data available',
  pagination = false,
  page = 0,
  onPageChange,
  hasNextPage,
  hasPrevPage,
}: DataTableScreenProps<T>) {
  return (
    <div className='flex flex-col gap-4 px-0 xs:px-4 md:gap-6 md:p-6'>
      {/* Header Section */}
      <div className='flex flex-col pt-4 px-4 gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center gap-3'>
          <Icon className='h-6 w-6 sm:h-8 sm:w-8 text-primary' />
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-foreground'>{title}</h1>
            <p className='text-sm sm:text-base text-muted-foreground mt-1'>
              {description}
            </p>
          </div>
        </div>
        {primaryAction && (
          <Button
            className='w-full sm:w-auto'
            onClick={primaryAction.onClick}
          >
            <primaryAction.icon className='h-4 w-4 mr-2' />
            <span className='sm:inline'>{primaryAction.label}</span>
          </Button>
        )}
      </div>

      {/* Description */}
      {infoDescription && (
        <Card className='bg-card border rounded-none xs:rounded-lg p-3 md:p-4 '>
          {/* If infoDescription is a string, render inside a paragraph; otherwise render the provided ReactNode
              directly so that block-level elements (e.g. <div>, <ul>, <pre>) can be used inside the description. */}
          {typeof infoDescription === 'string' ? (
            <p className='text-sm sm:text-base text-card-foreground'>{infoDescription}</p>
          ) : (
            <div className='text-sm sm:text-base text-card-foreground'>{infoDescription}</div>
          )}
        </Card>
      )}

      {/* Data Table */}
      <DataTable
        data={data}
        columns={columns}
        actions={actions}
        tableTitle={tableTitle}
        tableDescription={tableDescription}
        icon={Icon}
        mobileCardTitle={mobileCardTitle}
        mobileCardSubtitle={mobileCardSubtitle}
        mobileCardStatus={mobileCardStatus}
        mobileCardIcon={mobileCardIcon}
        onRowClick={onRowClick}
        rowClickable={rowClickable}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchKeys={searchKeys}
        columnFilterable={columnFilterable}
        defaultVisibleColumns={defaultVisibleColumns}
        mobileVisibleColumns={mobileVisibleColumns}
        loading={loading}
        emptyMessage={emptyMessage}
        pagination={pagination}
        page={page}
        onPageChange={onPageChange}
        hasNextPage={hasNextPage}
        hasPrevPage={hasPrevPage}
      />
    </div>
  )
}

