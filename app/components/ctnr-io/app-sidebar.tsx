import { Container } from 'lucide-react'
import * as React from 'react'

import { NavMain } from 'app/components/shadcn/nav-main.tsx'
import { NavUser } from 'app/components/ctnr-io/nav-user.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from 'app/components/shadcn/ui/sidebar.tsx'
import { AppSidebarLogo } from './app-sidebar-logo.tsx'
import { ClientContext } from 'ctx/mod.ts'

// ctnr.io navigation data
const data = {
  user: {
    name: 'Developer',
    email: 'dev@ctnr.io',
    avatar: '/avatars/user.jpg',
  },
  // projects: [
  //   {
  //     name: 'My Project',
  //     url: '#',
  //     icon: Frame,
  //   },
  // ],
  navMain: [
    {
      title: 'Containers',
      url: '/containers',
      icon: Container,
      isActive: true,
      items: [
        {
          title: 'List',
          url: '/containers',
        },
        {
          title: 'Create',
          url: '/containers/create',
        },
      ],
    },
    // {
    //   title: 'Volumes',
    //   url: '/volumes',
    //   icon: HardDrive,
    //   items: [
    //     {
    //       title: 'List',
    //       url: '/volumes',
    //     },
    //     {
    //       title: 'Create',
    //       url: '/volumes/create',
    //     },
    //   ],
    // },
    // {
    //   title: 'Domains',
    //   url: '/domains',
    //   icon: Globe,
    //   items: [
    //     {
    //       title: 'List',
    //       url: '/domains',
    //     },
    //     {
    //       title: 'Add Domain',
    //       url: '/domains/add',
    //     },
    //   ],
    // },
    // {
    //   title: 'Routes',
    //   url: '/routes',
    //   icon: Route,
    //   items: [
    //     {
    //       title: 'HTTPS Routes',
    //       url: '/routes/https',
    //     },
    //     {
    //       title: 'Create Route',
    //       url: '/routes/create',
    //     },
    //   ],
    // },
    // {
    //   title: 'Resources',
    //   url: '/resources',
    //   icon: Gauge,
    //   items: [
    //     {
    //       title: 'Quotas',
    //       url: '/resources/quotas',
    //     },
    //     {
    //       title: 'Usage',
    //       url: '/resources/usage',
    //     },
    //   ],
    // },
    // {
    //   title: 'Monitoring',
    //   url: '/monitoring',
    //   icon: Gauge,
    //   items: [
    //     {
    //       title: 'Dashboard',
    //       url: '/monitoring',
    //     },
    //     {
    //       title: 'Rules',
    //       url: '/monitoring/rules',
    //     },
    //     {
    //       title: 'Alerts',
    //       url: '/monitoring/alerts',
    //     },
    //   ],
    // },
    // {
    //   title: 'Builds',
    //   url: '/builds',
    //   icon: Hammer,
    //   items: [
    //     {
    //       title: 'List',
    //       url: '/builds',
    //     },
    //     {
    //       title: 'History',
    //       url: '/builds/history',
    //     },
    //   ],
    // },
    // {
    //   title: 'Deployments',
    //   url: '/deployments',
    //   icon: Rocket,
    //   items: [
    //     {
    //       title: 'List',
    //       url: '/deployments',
    //     },
    //     {
    //       title: 'GitHub App',
    //       url: '/deployments/github',
    //     },
    //   ],
    // },
    // {
    //   title: 'Billing',
    //   url: '/billing',
    //   icon: CreditCard,
    //   items: [
    //     {
    //       title: 'Overview',
    //       url: '/billing',
    //     },
    //     {
    //       title: 'Invoices',
    //       url: '/billing/invoices',
    //     },
    //     {
    //       title: 'Payment Methods',
    //       url: '/billing/payment',
    //     },
    //   ],
    // },
    // {
    //   title: 'Notifications',
    //   url: '/notifications',
    //   icon: Bell,
    //   items: [
    //     {
    //       title: 'List',
    //       url: '/notifications',
    //     },
    //     {
    //       title: 'Settings',
    //       url: '/notifications/settings',
    //     },
    //   ],
    // },
  ],
}

export function AppSidebar({ user, onLogout, ...props }: React.ComponentProps<typeof Sidebar> & {
  user: {
    email: string
    name: string
    avatar: string
  },
  onLogout: () => unknown 
}) {
  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <AppSidebarLogo />
      </SidebarHeader>
      <SidebarContent>
        {/* <NavProjects projects={data.projects} /> */}
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
