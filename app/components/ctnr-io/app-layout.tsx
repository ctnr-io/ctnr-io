'use dom'

import { ThemeProvider } from 'app/components/ctnr-io/theme-provider.tsx'
import { PropsWithChildren } from 'react'

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  )
}
