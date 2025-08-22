'use dom'

import { AppSidebar } from 'app/components/ctnr-io/app-sidebar.tsx'
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
    children
  )
}