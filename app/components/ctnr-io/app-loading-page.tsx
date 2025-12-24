'use dom'

import 'app/global.css'

import { cn } from 'lib/shadcn/utils.ts'
import { AppLogo } from './app-logo.tsx'
import { LoaderCircle } from 'lucide-react'

interface AppLoadingPageProps {
  className?: string
}

export default function AppLoadingPage({
  className,
}: AppLoadingPageProps) {
  return (
    <div className={cn('bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10', className)}>
      <div className='flex w-full max-w-sm flex-col gap-6'>
        <a href='#' className='flex items-center gap-2 self-center font-medium'>
          <AppLogo />
        </a>
        <div className='flex flex-col gap-6 justify-center items-center'>
					<LoaderCircle className="animate-spin text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
