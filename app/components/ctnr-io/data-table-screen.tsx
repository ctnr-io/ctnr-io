'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Input } from 'app/components/shadcn/ui/input.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'app/components/shadcn/ui/table.tsx'
import { Skeleton } from 'app/components/shadcn/ui/skeleton.tsx'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LucideIcon, Search, Settings2 } from 'lucide-react'
import { ReactNode, useMemo, useState, MouseEvent } from 'react'
import { Checkbox } from 'app/components/shadcn/ui/checkbox.tsx'
import { Card, CardContent, CardFooter, CardHeader } from '../shadcn/ui/card.tsx'
import { cn } from 'lib/shadcn/utils.ts'

export interface TableColumn<T = any> {
  key: string
  label: string
  render?: (value: any, item: T) => ReactNode
  className?: string
  mobileLabel?: string // For mobile card view
  visibleOnMobile?: boolean // Hide this column on mobile
}

export interface TableAction<T = any> {
  icon: LucideIcon
  label: string
  disabled?: boolean
  onClick?: (item: T) => void
  variant?: 'default' | 'ghost' | 'destructive'
  className?: string
  condition?: (item: T) => boolean // Show action only if condition is true
  Wrapper?: (props: { item: T; children: ReactNode }) => ReactNode // Wrapper component for modals/dialogs
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
  infoDescription?: ReactNode

  // Table props
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

function ActionWrapperDefault({ children }: { children: ReactNode }) {
  return children
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

  const isInteractiveTarget = (el: Element | null) => {
    if (!el) return false
    // Any element that should not trigger row click (native or marked)
    const interactiveSelector = 'a[href], button, input, textarea, select, label, [role="button"], [data-no-row-click]'
    return !!el.closest(interactiveSelector)
  }

  const handleRowClickFromEvent = (e: MouseEvent<HTMLElement>, item: T) => {
    if (!rowClickable || !onRowClick) return
    const target = e.target as Element | null
    // if clicking inside an interactive element (link/button/input), don't trigger row click
    if (isInteractiveTarget(target)) return
    // Also respect events that called e.stopPropagation() or e.defaultPrevented
    if (e.isPropagationStopped?.()) return
    if (e.defaultPrevented) return
    onRowClick(item)
  }

  const renderMobileCard = (item: T, index: number) => {
    const status = mobileCardStatus?.(item)

    return (
      <div
        key={index}
        className={cn(
          'border-b last:border-b-0 p-2 flex flex-col gap-2',
          rowClickable && onRowClick ? 'cursor-pointer hover:bg-muted/20 transition-all duration-200' : '',
        )}
        onClick={(e) => handleRowClickFromEvent(e, item)}
      >
        <div className='flex-1 flex flex-row justify-between mx-2 mt-2 gap-3'>
          <div className='w-56 flex items-center gap-3'>
            <div className='flex-shrink-0 p-2 bg-primary/10 rounded-lg'>
              {mobileCardIcon ? mobileCardIcon(item) : <Icon className='h-4 w-4 text-primary' />}
            </div>
            <div className='min-w-0'>
              <h3 className='font-semibold text-base text-foreground truncate'>{mobileCardTitle(item)}</h3>
              {mobileCardSubtitle && (
                <p className='text-sm text-muted-foreground mt-1 leading-relaxed'>{mobileCardSubtitle(item)}</p>
              )}
            </div>
          </div>
          {status && (
            <div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${status.className} shadow-sm flex-shrink-0`}
              >
                {status.label}
              </span>
            </div>
          )}
          <div className='w-56 hidden sm:flex items-center justify-end gap-3 min-w-0'>
            {actions
              .filter((action) => !action.condition || action.condition(item))
              .map(({ Wrapper = ActionWrapperDefault, ...action }) => (
                <Wrapper item={item} key={action.label}>
                    <Button
                    variant={action.variant || 'ghost'}
                    size='sm'
                    onClick={!action.onClick ? undefined : (e) => {
                      e.stopPropagation() // Prevent card click when clicking action buttons
                      action.onClick?.(item)
                    }}
                    className={`${action.className} shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                    title={action.label}
                    disabled={action.disabled}
                  >
                    <action.icon className='h-4 w-4' />
                  </Button>
                </Wrapper>
              ))}
          </div>
        </div>

        <div className='space-y-3 mx-2'>
          {columns
            .filter((col) => mobileVisibleColumns?.includes(col.key))
            .map((column) => {
              const value = item[column.key as keyof T]
              const displayValue = column.render ? column.render(value, item) : String(value || '')

              if (!displayValue || displayValue === '-') return null

              return (
                <div
                  key={column.key}
                  className='flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg border'
                >
                  <span className='text-sm font-medium text-muted-foreground'>
                    {column.mobileLabel || column.label}
                  </span>
                  <span className={`text-sm font-medium text-foreground ${column.className || ''}`}>
                    {displayValue}
                  </span>
                </div>
              )
            })}
        </div>
      </div>
    )
  }

  const renderDesktopTable = () => {
    const visibleColumnsArray = columns.filter((col) => visibleColumns.has(col.key))

    return (
      <CardContent className='hidden md:block overflow-x-auto px-0'>
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumnsArray.map((column) => (
                <TableHead key={column.key} className={cn(column.className, 'px-6')}>
                  {column.label}
                </TableHead>
              ))}
              {actions.length > 0 && <TableHead className='text-right px-6'>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? (
                // Show skeleton rows when loading
                [...Array(5)].map((_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    {visibleColumnsArray.map((column) => (
                      <TableCell key={column.key} className={cn(column.className, 'px-6')}>
                        <Skeleton className='h-4' style={{ width: `${Math.random() * 40 + 60}%` }} />
                      </TableCell>
                    ))}
                    {actions.length > 0 && (
                      <TableCell className='text-right px-6'>
                        <div className='flex items-center justify-end gap-1'>
                          <Skeleton className='h-8 w-8' />
                          <Skeleton className='h-8 w-8' />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )
              : (
                // Show actual data when not loading
                filteredData.map((item, index) => (
                  <TableRow
                    key={index}
                    className={rowClickable && onRowClick ? 'cursor-pointer hover:bg-muted/20' : ''}
                    onClick={(e) => handleRowClickFromEvent(e, item)}
                  >
                    {visibleColumnsArray.map((column) => {
                      const value = item[column.key as keyof T]
                      const displayValue = column.render ? column.render(value, item) : String(value || '')

                      return (
                        <TableCell key={column.key} className={cn(column.className, 'px-6')}>
                          {displayValue}
                        </TableCell>
                      )
                    })}
                    {actions.length > 0 && (
                      <TableCell className='text-right px-6'>
                        <div className='flex items-center justify-end gap-1'>
                          {actions
                            .filter((action) => !action.condition || action.condition(item))
                            .map(({ Wrapper = ActionWrapperDefault, ...action }) => (
                              <Wrapper item={item} key={action.label}>
                                <Button
                                  variant={action.variant || 'ghost'}
                                  size='sm'
                                  onClick={!action.onClick ? undefined : (e) => {
                                    e.stopPropagation() // Prevent card click when clicking action buttons
                                    action.onClick?.(item)
                                  }}
                                  className={`${action.className} cursor-pointer`}
                                  title={action.label}
                                  disabled={action.disabled}
                                >
                                  <action.icon className='h-4 w-4' />
                                </Button>
                              </Wrapper>
                            ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
          </TableBody>
        </Table>
      </CardContent>
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
              className='bg-primary hover:bg-primary/10 w-full sm:w-auto'
              onClick={primaryAction.onClick}
            >
              <primaryAction.icon className='h-4 w-4 mr-2' />
              <span className='sm:inline'>{primaryAction.label}</span>
            </Button>
          )}
        </div>

        {/* Description */}
        {infoDescription && (
          <Card className='bg-card border rounded-lg p-3 md:p-4 '>
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
        <Card className='overflow-hidden gap-0 pb-0'>
          <CardHeader className='border-b'>
            <h2 className='text-lg sm:text-xl font-semibold'>{tableTitle}</h2>
            {tableDescription && (
              <p className='text-xs sm:text-sm text-muted-foreground'>
                {tableDescription}
              </p>
            )}
          </CardHeader>

          {/* Desktop Search and Filter Bar */}
          {(searchable || columnFilterable) && (
            <CardHeader className='hidden md:block border-b pt-6'>
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
                      <div className='absolute top-full mt-2 -left-1/2 bg-card border rounded-lg shadow-lg p-3 min-w-64 z-10'>
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
                                    ? <Eye className='h-3 w-3 text-chart-2' />
                                    : <EyeOff className='h-3 w-3 text-muted-foreground' />}
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
            </CardHeader>
          )}

          {loading
            ? (
              <>
                {/* Mobile Card View - Loading */}
                <div className='block md:hidden'>
                  {[...Array(5)].map((_, index) => (
                    <div key={`mobile-skeleton-${index}`} className='border-b last:border-b-0 p-2'>
                      <div className='flex items-start justify-between'>
                        <div className='flex items-center gap-3 flex-1 min-w-0'>
                          <div className='flex-shrink-0 p-2 bg-muted rounded-lg'>
                            <Skeleton className='h-4 w-4' />
                          </div>
                          <div className='flex-1 min-w-0'>
                            <Skeleton className='h-4 w-32 mb-2' />
                            <Skeleton className='h-3 w-48' />
                          </div>
                        </div>
                        <Skeleton className='h-6 w-16 rounded-full flex-shrink-0 ml-3' />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View - Loading */}
                {renderDesktopTable()}
              </>
            )
            : filteredData.length === 0
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
          {/* Pagination controls */}
          {pagination && (
            <CardFooter className='flex justify-center gap-3 border-t !py-2'>
              <Button
                variant='outline'
                size='sm'
                className='cursor-pointer'
                onClick={() => onPageChange?.(page - 1)}
                disabled={!hasPrevPage}
              >
                <ArrowLeft /> Previous
              </Button>
              <span className='text-sm'>Page {page + 1}</span>
              <Button
                variant='outline'
                size='sm'
                className='cursor-pointer'
                onClick={() => onPageChange?.(page + 1)}
                disabled={!hasNextPage}
              >
                Next <ArrowRight />
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
      {/* Mobile Search and Filter Bar - Bottom positioned for better UX */}
      {(searchable || columnFilterable) && (
        <div className='sticky bottom-0 left-0 right-0 bg-card md:hidden border-t p-3 drop-shadow-sm'>
          <div className='space-y-3'>
            {searchable && (
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground bg-background' />
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
