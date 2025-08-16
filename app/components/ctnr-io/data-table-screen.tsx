'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'app/components/shadcn/ui/table.tsx'
import { Eye, EyeOff, LucideIcon, Search, Settings2 } from 'lucide-react'
import { ReactNode, useMemo, useState } from 'react'
import { Checkbox } from 'app/components/shadcn/ui/checkbox.tsx'

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
  mobileCardIcon,
  onRowClick,
  rowClickable = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys,
  columnFilterable = false,
  defaultVisibleColumns,
  loading = false,
  emptyMessage = 'No data available',
}: DataTableScreenProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (defaultVisibleColumns) {
      return new Set(defaultVisibleColumns)
    }
    // By default, show all columns
    return new Set(columns.map((col) => col.key))
  })

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
      <div
        key={index}
        className={`border-b last:border-b-0 p-2 ${
          rowClickable && onRowClick ? 'cursor-pointer hover:bg-muted/30 transition-all duration-200' : ''
        }`}
        onClick={() => rowClickable && onRowClick && onRowClick(item)}
      >
        <div className='flex items-start justify-between'>
          <div className='flex items-center gap-3 flex-1 min-w-0'>
            <div className='flex-shrink-0 p-2 bg-primary/10 rounded-lg'>
              {mobileCardIcon ? mobileCardIcon(item) : <Icon className='h-4 w-4 text-primary' />}
            </div>
            <div className='flex-1 min-w-0'>
              <h3 className='font-semibold text-base text-foreground truncate'>{mobileCardTitle(item)}</h3>
              {mobileCardSubtitle && (
                <p className='text-sm text-muted-foreground mt-1 leading-relaxed'>{mobileCardSubtitle(item)}</p>
              )}
            </div>
          </div>
          {status && (
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${status.className} shadow-sm flex-shrink-0 ml-3`}
            >
              {status.label}
            </span>
          )}
        </div>
        {
          /*
        <div className='space-y-3 mb-4'>
          {columns
            .filter((col) => !col.hiddenOnMobile && visibleColumns.has(col.key))
            .map((column) => {
              const value = item[column.key as keyof T]
              const displayValue = column.render ? column.render(value, item) : String(value || '')

              if (!displayValue || displayValue === '-') return null

              return (
                <div key={column.key} className='flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg border'>
                  <span className='text-sm font-medium text-muted-foreground'>{column.mobileLabel || column.label}</span>
                  <span className={`text-sm font-medium text-foreground ${column.className || ''}`}>{displayValue}</span>
                </div>
              )
            })}
        </div> */
        }

        {
          /* {actions.length > 0 && (
          <div className='flex items-center justify-center gap-2 pt-2 border-t border-muted/30'>
            {actions
              .filter((action) => !action.condition || action.condition(item))
              .map((action, actionIndex) => (
                <Button
                  key={actionIndex}
                  variant={action.variant || 'ghost'}
                  size='sm'
                  onClick={(e) => {
                    e.stopPropagation() // Prevent card click when clicking action buttons
                    action.onClick(item)
                  }}
                  className={`${action.className} shadow-sm hover:shadow-md transition-shadow`}
                  title={action.label}
                >
                  <action.icon className='h-4 w-4' />
                </Button>
              ))}
          </div>
        )} */
        }
      </div>
    )
  }

  const renderDesktopTable = () => {
    const visibleColumnsArray = columns.filter((col) => visibleColumns.has(col.key))

    return (
      <div className='hidden md:block overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumnsArray.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
              {actions.length > 0 && <TableHead className='text-right'>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item, index) => (
              <TableRow
                key={index}
                className={rowClickable && onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                onClick={() => rowClickable && onRowClick && onRowClick(item)}
              >
                {visibleColumnsArray.map((column) => {
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
                            onClick={(e) => {
                              e.stopPropagation() // Prevent row click when clicking action buttons
                              action.onClick(item)
                            }}
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
  }

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
    <div className='flex flex-col justify-between h-full md:h-auto'>
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

          {/* Desktop Search and Filter Bar */}
          {(searchable || columnFilterable) && (
            <div className='hidden md:block p-3 md:p-4 border-b'>
              <div className='flex items-center gap-4'>
                {searchable && (
                  <div className='relative min-w-sm'>
                    <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                    <Input
                      placeholder={searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className='pl-9'
                    />
                  </div>
                )}

                {columnFilterable && (
                  <div className='relative'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setShowColumnFilter(!showColumnFilter)}
                      className='flex items-center gap-2'
                    >
                      <Settings2 className='h-4 w-4' />
                      Columns
                    </Button>

                    {showColumnFilter && (
                      <div className='absolute top-full mt-2 -left-1/2 bg-white border rounded-lg shadow-lg p-3 min-w-64 z-10'>
                        <div className='space-y-3'>
                          <div className='grid grid-cols-2 gap-1'>
                            {columns.map((column) => (
                              <label key={column.key} className='flex items-center gap-3 text-sm cursor-pointer'>
                                <Checkbox
                                  key={column.key}
                                  checked={visibleColumns.has(column.key)}
                                  onCheckedChange={(checked) => {
                                    const newVisibleColumns = new Set(visibleColumns)
                                    if (checked) {
                                      newVisibleColumns.add(column.key)
                                    } else {
                                      newVisibleColumns.delete(column.key)
                                    }
                                    setVisibleColumns(newVisibleColumns)
                                  }}
                                  className='rounded'
                                  title={column.label}
                                />
                                <span className='flex items-center gap-2 text-sm'>
                                  {visibleColumns.has(column.key)
                                    ? <Eye className='h-3 w-3 text-green-600' />
                                    : <EyeOff className='h-3 w-3 text-gray-400' />}
                                  {column.mobileLabel || column.label}
                                </span>
                              </label>
                            ))}
                          </div>

                          <div className='pt-2 mt-2 flex gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setVisibleColumns(new Set(columns.map((col) => col.key)))}
                              className='text-xs flex-1'
                            >
                              Show All
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setVisibleColumns(new Set())}
                              className='text-xs flex-1'
                            >
                              Hide All
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
        </div>
      </div>
      {/* Mobile Search and Filter Bar - Bottom positioned for better UX */}
      {(searchable || columnFilterable) && (
        <div className='sticky bottom-0 left-0 right-0 bg-white md:hidden border-t p-3'>
          <div className='space-y-3'>
            {searchable && (
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-9 w-full'
                />
              </div>
            )}

            {
              /* {columnFilterable && (
              <div className='relative'>
                <Button
                  variant={!showColumnFilter ? 'outline' : 'secondary'}
                  size='sm'
                  onClick={() => setShowColumnFilter(!showColumnFilter)}
                  className='flex items-center gap-2 w-full justify-center'
                >
                  <Settings2 className='h-4 w-4' />
                  Manage Columns
                </Button>

                {showColumnFilter && (
                  <div className='bottom-full left-0 right-0 bg-white p-3 z-10'>
                    <div className='space-y-3'>
                      <div className='grid grid-cols-2 gap-1'>
                        {columns.map((column) => (
                          <label key={column.key} className='flex items-center gap-3 text-sm cursor-pointer'>
                            <Checkbox
                              key={column.key}
                              checked={visibleColumns.has(column.key)}
                              onCheckedChange={(checked) => {
                                const newVisibleColumns = new Set(visibleColumns)
                                if (checked) {
                                  newVisibleColumns.add(column.key)
                                } else {
                                  newVisibleColumns.delete(column.key)
                                }
                                setVisibleColumns(newVisibleColumns)
                              }}
                              className='rounded'
                              title={column.label}
                            />
                            <span className='flex items-center gap-2 text-sm'>
                              {visibleColumns.has(column.key)
                                ? <Eye className='h-3 w-3 text-green-600' />
                                : <EyeOff className='h-3 w-3 text-gray-400' />}
                              {column.mobileLabel || column.label}
                            </span>
                          </label>
                        ))}
                      </div>

                      <div className='pt-2 mt-2 flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setVisibleColumns(new Set(columns.map((col) => col.key)))}
                          className='text-xs flex-1'
                        >
                          Show All
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setVisibleColumns(new Set())}
                          className='text-xs flex-1'
                        >
                          Hide All
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )} */
            }
          </div>
        </div>
      )}
    </div>
  )
}
