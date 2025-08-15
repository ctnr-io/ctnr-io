'use dom'

import { Button } from 'app/components/shadcn/ui/button.tsx'
import { Separator } from 'app/components/shadcn/ui/separator.tsx'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

export interface ItemField {
  key: string
  label: string
  value: any
  render?: (value: any) => ReactNode
  className?: string
  copyable?: boolean // Allow copying the value
  hiddenOnMobile?: boolean // Hide this field on mobile
}

export interface ItemAction {
  icon: LucideIcon
  label: string
  onClick: () => void
  variant?: 'default' | 'ghost' | 'destructive' | 'outline' | 'secondary'
  className?: string
  condition?: boolean // Show action only if condition is true
  size?: 'default' | 'sm' | 'lg'
}

export interface ItemSection {
  title: string
  description?: string
  fields: ItemField[]
  className?: string
}

export interface DataItemScreenProps {
  // Header props
  title: string
  description: string
  icon: LucideIcon
  
  // Status/Badge
  status?: {
    label: string
    className: string
  }

  // Action buttons
  primaryAction?: ItemAction
  secondaryActions?: ItemAction[]

  // Content sections
  sections: ItemSection[]

  // Additional content
  children?: ReactNode

  // Loading and error states
  loading?: boolean
  error?: string
  notFound?: boolean
  notFoundMessage?: string

  // Breadcrumb navigation
  breadcrumb?: {
    items: Array<{
      label: string
      href?: string
    }>
  }
}

export function DataItemScreen({
  title,
  description,
  icon: Icon,
  status,
  primaryAction,
  secondaryActions = [],
  sections,
  children,
  loading = false,
  error,
  notFound = false,
  notFoundMessage = 'Item not found',
}: DataItemScreenProps) {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
      console.log('Copied to clipboard:', text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const renderFieldValue = (field: ItemField) => {
    if (field.render) {
      return field.render(field.value)
    }

    if (field.value === null || field.value === undefined) {
      return <span className="text-muted-foreground">-</span>
    }

    if (Array.isArray(field.value)) {
      return field.value.length > 0 ? field.value.join(', ') : '-'
    }

    return String(field.value)
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

  if (error) {
    return (
      <div className='flex flex-col gap-4 p-4 md:gap-6 md:p-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <div className='text-destructive font-medium mb-2'>Error</div>
            <div className='text-muted-foreground'>{error}</div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className='flex flex-col gap-4 p-4 md:gap-6 md:p-6'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <Icon className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
            <div className='text-muted-foreground'>{notFoundMessage}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4 p-4 md:gap-6 md:p-6'>


      {/* Header Section */}
      <div className=''>
        <div className='flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'>
          <div className='flex items-start gap-4'>
            <div className='flex-shrink-0 p-3 bg-primary/10 rounded-xl'>
              <Icon className='h-8 w-8 text-primary' />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-3 mb-2 flex-wrap'>
                <h1 className='text-3xl font-bold text-foreground truncate'>{title}</h1>
                {status && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.className}`}>
                    {status.label}
                  </span>
                )}
              </div>
              <p className='text-base text-muted-foreground leading-relaxed'>
                {description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className='flex flex-col sm:flex-row gap-3 '>
            {secondaryActions.length > 0 && (
              <div className='flex flex-wrap gap-2 md:justify-end'>
                {secondaryActions
                  .filter(action => action.condition !== false)
                  .map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || 'outline'}
                      size={action.size || 'default'}
                      onClick={action.onClick}
                      className={`${action.className}`}
                    >
                      <action.icon className='h-4 w-4' />
                      <span className='hidden sm:inline'>{action.label}</span>
                    </Button>
                  ))}
              </div>
            )}
            
            {primaryAction && primaryAction.condition !== false && (
              <Button
                variant={primaryAction.variant || 'default'}
                size={primaryAction.size || 'default'}
                onClick={primaryAction.onClick}
                className={`${primaryAction.className}`}
              >
                <primaryAction.icon className='h-4 w-4 mr-2' />
                <span>{primaryAction.label}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className='space-y-6'>
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={`bg-card border rounded-xl overflow-hidden ${section.className || ''}`}>
            <div className='bg-gradient-to-r from-muted/30 to-muted/10 p-6 border-b'>
              <h2 className='text-xl font-semibold text-foreground'>{section.title}</h2>
              {section.description && (
                <p className='text-sm text-muted-foreground mt-2 leading-relaxed'>
                  {section.description}
                </p>
              )}
            </div>

            <div className='p-6'>
              {/* Desktop Layout */}
              <div className='hidden md:block'>
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className='space-y-2'>
                      <label className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
                        {field.label}
                      </label>
                      <div className={`flex items-start gap-3 bg-muted/20 rounded-lg border ${field.className || ''}`}>
                        <div className='flex-1 min-w-0 p-3'>
                          <div className='text-sm font-medium text-foreground break-words'>
                            {renderFieldValue(field)}
                          </div>
                        </div>
                        {field.copyable && field.value && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => copyToClipboard(String(field.value))}
                            className='h-8 w-8 mt-1.5 mx-2 hover:bg-primary/10 flex-shrink-0'
                            title='Copy to clipboard'
                          >
                            <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z' />
                            </svg>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Layout */}
              <div className='block md:hidden space-y-4'>
                {section.fields
                  .filter(field => !field.hiddenOnMobile)
                  .map((field, fieldIndex) => (
                    <div key={fieldIndex} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <label className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
                          {field.label}
                        </label>
                        {field.copyable && field.value && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => copyToClipboard(String(field.value))}
                            className='h-8 w-8 p-0 hover:bg-primary/10'
                            title='Copy to clipboard'
                          >
                            <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z' />
                            </svg>
                          </Button>
                        )}
                      </div>
                      <div className={`p-3 bg-muted/20 rounded-lg border ${field.className || ''}`}>
                        <div className='text-sm font-medium text-foreground break-words'>
                          {renderFieldValue(field)}
                        </div>
                      </div>
                      {fieldIndex < section.fields.filter(f => !f.hiddenOnMobile).length - 1 && (
                        <Separator className='my-4' />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ))}

        {/* Additional Content */}
        {children && (
          <div className='bg-card border rounded-xl p-6'>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}
