'use dom'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'app/components/shadcn/ui/card.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'app/components/shadcn/ui/tabs.tsx'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import { Copy } from 'lucide-react'
import { ReactNode } from 'react'

// Generic data item that can be a single value or an array of values
export type DataItem = {
  label?: string
  value: string | number | ReactNode | Array<string | number | ReactNode>
  variant?: 'default' | 'mono' | 'link' | 'copyable'
  className?: string
  fullWidth?: boolean // Allow item to span full width in grid
}

// Section within a card (like "Port Mappings", "Routes")
export type DataSection = {
  title: string
  items: DataItem[]
}

// Card structure with data items
export type DataCard = {
  title: string
  description?: string
  content: ReactNode | DataItem[] | DataSection[]
  className?: string
}

// Tab structure with cards or custom content
export type DataTab = {
  id: string
  label: string
  icon?: ReactNode
  cards?: DataCard[]
  content?: ReactNode
  className?: string
  hideLabel?: boolean
}

// Main component props
export type DataDetailsScreenProps = {
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: {
    text: string
    className?: string
  }
  headerActions?: ReactNode
  tabs: DataTab[]
  defaultTab?: string
  isLoading?: boolean
  loadingText?: string
}

// Render a single data item
function DataItemRenderer({ item }: { item: DataItem }) {
  const renderValue = (val: string | number | ReactNode, isLink = false) => {
    if (typeof val === 'string' || typeof val === 'number') {
      if (isLink && typeof val === 'string') {
        return (
          <a
            href={val}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:text-primary/80 underline text-sm font-mono bg-muted/60 px-2 py-1 rounded'
          >
            {val}
          </a>
        )
      }
      return (
        <Badge
          variant='outline'
          className={item.variant === 'mono' ? 'font-mono' : ''}
        >
          {val}
        </Badge>
      )
    }
    return val
  }

  const renderContent = () => {
    if (Array.isArray(item.value)) {
      return (
        <div className='space-y-1'>
          {item.value.map((val, idx) => (
            <div key={idx} className='flex items-center gap-2'>
              {typeof val === 'string' && (item.variant === 'link') ? (
                <>
                  <a
                    href={val}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary hover:text-primary/80 underline text-sm font-mono bg-muted/60 px-2 py-1 rounded'
                  >
                    {val}
                  </a>
                </>
              ) : (
                <>
                  <div className='font-mono text-sm bg-muted/60 px-2 py-1 rounded'>
                    {typeof val === 'string' || typeof val === 'number' ? val : renderValue(val)}
                  </div>
                  {item.variant === 'copyable' && typeof val === 'string' && (
                    <button
                      type='button'
                      onClick={() => navigator.clipboard.writeText(String(val))}
                      className='p-1 hover:bg-muted rounded'
                      title={item.label ? `Copy ${item.label}` : 'Copy'}
                    >
                      <Copy className='h-3 w-3' />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )
    }

    // Single value rendering
    const isLink = item.variant === 'link'
    return (
      <div className='flex items-center gap-2'>
        {renderValue(item.value, isLink)}
        {(item.variant === 'copyable') && typeof item.value === 'string' && (
          <button
            type='button'
            onClick={() => navigator.clipboard.writeText(String(item.value))}
            className='p-1 hover:bg-muted rounded'
            title={item.label ? `Copy ${item.label}` : 'Copy'}
          >
            <Copy className='h-3 w-3' />
          </button>
        )}
      </div>
    )
  }

  // If no label, render just the content without the label-value layout
  if (!item.label) {
    return (
      <div className={`p-3 bg-muted/60 rounded-lg ${item.className || ''} ${item.fullWidth ? 'md:col-span-2' : ''}`}>
        {renderContent()}
      </div>
    )
  }

  return (
    <div className={`flex justify-between items-center p-3 bg-muted/60 rounded-lg ${item.className || ''} ${item.fullWidth ? 'md:col-span-2' : ''}`}>
      <span className='text-foreground font-medium'>{item.label}</span>
      {renderContent()}
    </div>
  )
}

// Render card content - either custom ReactNode, array of DataItems, or array of DataSections
function CardContentRenderer({ content }: { content: ReactNode | DataItem[] | DataSection[] }) {
  // Check if it's an array
  if (Array.isArray(content) && content.length > 0) {
    // Check if it's an array of DataSections (has title property)
    if ('title' in content[0] && 'items' in content[0]) {
      const sections = content as DataSection[]
      return (
        <>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {sections[0].items.map((item, idx) => (
              <DataItemRenderer key={idx} item={item} />
            ))}
          </div>
          {sections.slice(1).map((section, sectionIdx) => (
            <div key={sectionIdx} className='mt-4'>
              <h4 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2'>
                {section.title}
              </h4>
              <div className='space-y-2'>
                {section.items.map((item, idx) => (
                  <DataItemRenderer key={idx} item={item} />
                ))}
              </div>
            </div>
          ))}
        </>
      )
    }

    // Otherwise it's an array of DataItems
    const items = content as DataItem[]
    return (
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {items.map((item, idx) => (
          <DataItemRenderer key={idx} item={item} />
        ))}
      </div>
    )
  }

  // Otherwise it's custom ReactNode content
  return <>{content}</>
}

export function DataDetailsScreen(props: DataDetailsScreenProps) {
  const {
    title,
    subtitle,
    icon,
    badge,
    headerActions,
    tabs,
    defaultTab,
    isLoading = false,
    loadingText = 'Loading details...',
  } = props

  if (isLoading) {
    return (
      <div className='bg-background'>
        <div className='container mx-auto px-6 py-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-foreground mb-2'>{title}</h1>
            <p className='text-muted-foreground'>{loadingText}</p>
          </div>
          <div className='flex items-center justify-center py-20'>
            <div className='text-center'>
              <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
              <p className='text-muted-foreground text-lg'>{loadingText}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='bg-background'>
      <div className='container mx-auto px-6 pt-8 py-8'>
        {/* Header */}
        <div className='px-4 sm:mb-8 flex items-start justify-between space-y-4'>
          <div>
            <div className='flex items-center gap-3 mb-2'>
              {icon}
              <h1 className='text-3xl font-bold text-foreground'>{title}</h1>
              {badge && (
                <span className={`hidden sm:inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
                  {badge.text}
                </span>
              )}
            </div>
            {subtitle && <p className='hidden sm:inline text-muted-foreground'>{subtitle}</p>}
          </div>
          {headerActions && (
            <div className='flex items-center justify-end gap-2 min-w-50 mt-1'>
              {headerActions}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab || tabs[0]?.id} className='space-y-6'>
          <TabsList className='w-full flex justify-evenly'>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className={`text-sm font-medium flex-1 ${tab.className || ''}`}>
                {tab.icon && <span className='h-4 w-4 sm:mr-2'>{tab.icon}</span>}
                {!tab.hideLabel && <span className='hidden sm:inline'>{tab.label}</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab Contents */}
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className={tab.className || 'space-y-6'}>
              {/* Custom content takes precedence */}
              {tab.content ? (
                <>{tab.content}</>
              ) : (
                /* Render cards if no custom content */
                tab.cards?.map((card, cardIdx) => (
                  <Card key={cardIdx} className={card.className}>
                    <CardHeader>
                      <CardTitle className='text-foreground'>{card.title}</CardTitle>
                      {card.description && <CardDescription>{card.description}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                      <CardContentRenderer content={card.content} />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
