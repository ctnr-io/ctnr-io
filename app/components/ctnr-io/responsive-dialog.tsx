"use client"

import * as React from "react"
import * as ShadcnDialog from "app/components/shadcn/ui/dialog.tsx"
import { cn } from "lib/shadcn/utils.ts"

// Generic, responsive dialog wrapper. Exposes the same named components
// as the shadcn dialog, but makes Content fullscreen on small screens by
// default. Also provides a compound default export that groups the
// components under a single `ResponsiveDialog` object.

type ResponsiveDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
  triggerAsChild?: boolean
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode | ((close: () => void) => React.ReactNode)
  children?: React.ReactNode
  content?: React.ReactNode
  showCloseButton?: boolean
  fullscreenOnMobile?: boolean
  contentClassName?: string
  breakpoint?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'xs'
}

/**
 * ResponsiveDialog
 *
 * A single, generic dialog component that composes the shadcn Dialog
 * primitives but provides a simpler API for common use-cases.
 *
 * Props:
 * - trigger: ReactNode rendered as the dialog trigger (uses asChild by default)
 * - title / description: optional header content
 * - footer: ReactNode or (close) => ReactNode to render footer actions
 * - contentClassName: className forwarded to the internal Content element
 *
 * Example usage:
 * <ResponsiveDialog
 *   trigger={<Button>Open</Button>}
 *   title="Are you sure?"
 *   description="This action cannot be undone"
 *   footer={(close) => (<><Button onClick={() => close()}>Cancel</Button><Button>Confirm</Button></>)}
 * >
 *   <p>Dialog body</p>
 * </ResponsiveDialog>
 */
export default function ResponsiveDialog({
  open,
  onOpenChange,
  trigger,
  triggerAsChild = true,
  title,
  description,
  footer,
  children,
  content = children,
  showCloseButton = true,
  contentClassName,
  breakpoint = 'xs',
}: ResponsiveDialogProps) {
  const isControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const value = isControlled ? open! : internalOpen
  const setValue = (v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v)
    } else {
      setInternalOpen(v)
    }
  }

  const close = () => setValue(false)

  const responsiveClass = `fixed z-50 w-full max-w-none max-h-[90vh] rounded-none m-0 p-4 ${breakpoint}:top-1/2 ${breakpoint}:left-1/2 ${breakpoint}:h-auto ${breakpoint}:w-auto ${breakpoint}:min-w-100 ${breakpoint}:rounded-lg ${breakpoint}:p-6`

  return (
    <ShadcnDialog.Dialog open={value} onOpenChange={setValue}>
      {trigger && (
        <ShadcnDialog.DialogTrigger asChild={triggerAsChild}>
          {trigger as any}
        </ShadcnDialog.DialogTrigger>
      )}

      <ShadcnDialog.DialogContent
        className={cn(responsiveClass, contentClassName)}
        showCloseButton={showCloseButton}
      >
        {title && (
          <ShadcnDialog.DialogHeader>
            <ShadcnDialog.DialogTitle>{title}</ShadcnDialog.DialogTitle>
            {description && (
              <ShadcnDialog.DialogDescription>{description}</ShadcnDialog.DialogDescription>
            )}
          </ShadcnDialog.DialogHeader>
        )}

        {content}

        {footer && (
          <ShadcnDialog.DialogFooter className='sticky bottom-0 bg-background/80 backdrop-blur-md'>
            {typeof footer === 'function' ? footer(close) : footer}
          </ShadcnDialog.DialogFooter>
        )}
      </ShadcnDialog.DialogContent>
    </ShadcnDialog.Dialog>
  )
}

// Also provide a named export for convenience
export { ResponsiveDialog }
