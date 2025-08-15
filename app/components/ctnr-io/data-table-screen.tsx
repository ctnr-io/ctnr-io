'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'app/components/shadcn/ui/table.tsx'
import { LucideIcon, Search } from 'lucide-react'
import { ReactNode, useMemo, useState } from 'react'

export interface TableColumn<T = any> {
  key: string
  label: string
  render?: (value: any, item: T) => ReactNode
  className?: string
  mobileLabel?: string // For mobile card view
  hiddenOnMobile?: boolean // Hide this column on mobile
}

export interface TableAction<T = any> {
  icon: LucideIcon
  label: string
  onClick: (item: T) => void
  variant?: 'default' | 'ghost' | 'destructive'
  className?: string
  condition?: (item: T) => boolean // Show action only if condition is true
}

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
  infoDescription?: string

  // Table props
  data: T[]
  columns: TableColumn<T>[]
  actions?: TableAction<T>[]

  // Table header
  tableTitle: string
  tableDescription?: string

  // Mobile card customization
  mobileCardTitle: (item: T) => string
  mobileCardSubtitle?: (item: T) => string
  mobileCardStatus?: (item: T) => { label: string; className: string }

  // Search functionality
  searchable?: boolean
  searchPlaceholder?: string
  searchKeys?: (keyof T)[] // Keys to search in

  // Loading and empty states
  loading?: boolean
  emptyMessage?: string
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
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys,
  loading = false,
  emptyMessage = 'No data available',
}: DataTableScreenProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchable || !searchQuery.trim()) {
      return data
    }

    const query = searchQuery.toLowerCase().trim()

    return data.filter((item) => {
      // If searchKeys are specified, only search in those fields
      if (searchKeys && searchKeys.length > 0) {
        return searchKeys.some((key) => {
          const value = item[key]
          if (value == null) return false
          return String(value).toLowerCase().includes(query)
        })
      }

      // Otherwise, search in all string-like fields
      return Object.values(item as any).some((value) => {
        if (value == null) return false
        if (Array.isArray(value)) {
          return value.some((v) => String(v).toLowerCase().includes(query))
        }
        return String(value).toLowerCase().includes(query)
      })
    })
  }, [data, searchQuery, searchable, searchKeys])

  const renderMobileCard = (item: T, index: number) => {
    const status = mobileCardStatus?.(item)

    return (
      <div key={index} className='border-b last:border-b-0 p-4'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <Icon className='h-4 w-4 text-muted-foreground' />
            <span className='font-medium text-sm'>{mobileCardTitle(item)}</span>
          </div>
          {status && (
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
              {status.label}
            </span>
          )}
        </div>

        {mobileCardSubtitle && <p className='text-xs text-muted-foreground mb-3'>{mobileCardSubtitle(item)}</p>}

        <div className='space-y-2 text-xs text-muted-foreground mb-3'>
          {columns
            .filter((col) => !col.hiddenOnMobile)
            .map((column) => {
              const value = item[column.key as keyof T]
              const displayValue = column.render ? column.render(value, item) : String(value || '')

              if (!displayValue || displayValue === '-') return null

              return (
                <div key={column.key} className='flex justify-between'>
                  <span>{column.mobileLabel || column.label}:</span>
                  <span className={column.className}>{displayValue}</span>
                </div>
              )
            })}
        </div>

        {actions.length > 0 && (
          <div className='flex items-center justify-center gap-1'>
            {actions
              .filter((action) => !action.condition || action.condition(item))
              .map((action, actionIndex) => (
                <Button
                  key={actionIndex}
                  variant={action.variant || 'ghost'}
                  size='sm'
                  onClick={() => action.onClick(item)}
                  className={action.className}
                  title={action.label}
                >
                  <action.icon className='h-4 w-4' />
                </Button>
              ))}
          </div>
        )}
      </div>
    )
  }

  const renderDesktopTable = () => (
    <div className='hidden md:block overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.label}
              </TableHead>
            ))}
            {actions.length > 0 && <TableHead className='text-right'>Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((item, index) => (
            <TableRow key={index}>
              {columns.map((column) => {
                const value = item[column.key as keyof T]
                const displayValue = column.render ? column.render(value, item) : String(value || '')

                return (
                  <TableCell key={column.key} className={column.className}>
                    {displayValue}
                  </TableCell>
                )
              })}
              {actions.length > 0 && (
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    {actions
                      .filter((action) => !action.condition || action.condition(item))
                      .map((action, actionIndex) => (
                        <Button
                          key={actionIndex}
                          variant={action.variant || 'ghost'}
                          size='sm'
                          onClick={() => action.onClick(item)}
                          className={action.className}
                          title={action.label}
                        >
                          <action.icon className='h-4 w-4' />
                        </Button>
                      ))}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  if (loading) {
    return (
      <div className='flex flex-col gap-4 p-4 md:gap-6 md:p-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-muted-foreground'>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4 p-4 md:gap-6 md:p-6'>
      {/* Header Section */}
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
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
            className='bg-primary hover:bg-primary/90 w-full sm:w-auto'
            onClick={primaryAction.onClick}
          >
            <primaryAction.icon className='h-4 w-4 mr-2' />
            <span className='sm:inline'>{primaryAction.label}</span>
          </Button>
        )}
      </div>

      {/* Description */}
      {infoDescription && (
        <div className='bg-card border rounded-lg p-3 md:p-4'>
          <p className='text-sm sm:text-base text-card-foreground'>
            {infoDescription}
          </p>
        </div>
      )}

      {/* Data Table */}
      <div className='bg-card border rounded-lg overflow-hidden'>
        <div className='p-3 md:p-4 border-b'>
          <h2 className='text-lg sm:text-xl font-semibold'>{tableTitle}</h2>
          {tableDescription && (
            <p className='text-xs sm:text-sm text-muted-foreground'>
              {tableDescription}
            </p>
          )}
        </div>

        {/* Desktop Search Bar */}
        {searchable && (
          <div className='hidden md:block p-3 md:p-4 border-b'>
            <div className='relative max-w-sm'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-9'
              />
            </div>
          </div>
        )}

        {filteredData.length === 0
          ? (
            <div className='p-8 text-center text-muted-foreground'>
              {searchQuery ? `No results found for "${searchQuery}"` : emptyMessage}
            </div>
          )
          : (
            <>
              {/* Mobile Card View */}
              <div className='block md:hidden'>
                {filteredData.map((item, index) => renderMobileCard(item, index))}
              </div>

              {/* Desktop Table View */}
              {renderDesktopTable()}
            </>
          )}

        {/* Mobile Search Bar - Bottom positioned for better UX */}
        {searchable && (
          <div className='absolute bottom-0 left-0 right-0 bg-white block md:hidden border-t p-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-9 w-full'
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
