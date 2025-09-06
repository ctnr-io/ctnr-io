'use dom'

import { AppSidebar } from 'app/components/ctnr-io/app-sidebar.tsx'
import CreditsDisplay from 'app/components/ctnr-io/credits-display.tsx'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from 'app/components/shadcn/ui/breadcrumb.tsx'
import { Separator } from 'app/components/shadcn/ui/separator.tsx'
import { SidebarInset, SidebarProvider, SidebarTrigger } from 'app/components/shadcn/ui/sidebar.tsx'
import { PropsWithChildren } from 'react'
import { ThemeProvider } from 'app/components/ctnr-io/theme-provider.tsx'

export default function AppLayout({ user, onLogout, children }: PropsWithChildren<{
  user: {
    id: string
    name: string
    email: string
    avatar: string
  }
  onLogout: () => Promise<void>
}>) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <AppSidebar user={user} onLogout={onLogout} />
        <SidebarInset className='overflow-auto'>
          <header className='sticky top-0 z-10 bg-white border-b flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 '>
            <div className='flex items-center gap-2 px-4 flex-1'>
              <SidebarTrigger className='-ml-1' />
              <Separator
                orientation='vertical'
                className='data-[orientation=vertical]:h-4'
              />
              {/* <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className='hidden md:block'>
                    <BreadcrumbLink href='#'>
                      My Project
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className='hidden md:block' />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Containers</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb> */}
            {/* </div> */}
            {/* <div className='flex items-center gap-2 px-4'> */}
              <CreditsDisplay />
            </div>
          </header>
          <main className='flex flex-1 flex-col'>
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}
