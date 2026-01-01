'use dom'

import 'app/global.css'

import { cn } from 'lib/shadcn/utils.ts'
import { AppLogo } from './app-logo.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../shadcn/ui/card.tsx'
import { Button } from 'app/components/shadcn/ui/button.tsx'
import { AlertCircle } from 'lucide-react'

interface AppErrorPageProps {
  className?: string
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function AppErrorPage({
  className,
  title = 'Oops! Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  actionLabel = 'Go to home',
  onAction,
}: AppErrorPageProps) {
  const handleAction = () => {
    if (onAction) {
      onAction()
    } else if (typeof globalThis.window !== 'undefined') {
      globalThis.location.href = '/'
    }
  }

  return (
    <div className={cn('bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10', className)}>
      <div className='flex w-full max-w-sm flex-col gap-6'>
        <a href='#' className='flex items-center gap-2 self-center font-medium'>
          <AppLogo />
        </a>
        <div className='flex flex-col gap-6'>
          <Card>
            <CardHeader className='text-center'>
              {/* <div className='flex justify-center mb-4'>
                <AlertCircle className='h-12 w-12 text-destructive' />
              </div> */}
              <CardTitle className='text-xl'>{title}</CardTitle>
              <CardDescription>
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant='default'
                className='w-full'
                onClick={handleAction}
              >
                {actionLabel}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
