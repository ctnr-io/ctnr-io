import { Container, FunctionSquare, HardDrive, LucideIcon } from 'lucide-react'
import * as React from 'react'

import { NavUser } from 'app/components/ctnr-io/nav-user.tsx'
import { Badge } from 'app/components/shadcn/ui/badge.tsx'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarRail,
} from 'app/components/shadcn/ui/sidebar.tsx'
import { Link, Route } from 'expo-router'
import { AppSidebarLogo } from './app-sidebar-logo.tsx'

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
  categories: [
      {
        title: "Compute",
        items: [{
          title: "Containers",
          url: "/containers",
          icon: Container,
        }, {
          title: "Functions",
          url: "/functions" as Route,
          icon: FunctionSquare,
          disabled: true,
        }],
      },
      {
        title: "Storage",
        items: [{
          title: "Volumes",
          url: "/volumes" as Route,
          icon: HardDrive,
          disabled: true,
        }, 
        // {
        //   title: "Database",
        //   url: "/databases" as Route,
        //   icon: Database,
        //   disabled: true,
        // }
      ]
      },
      // {
      //   title: "Network",
      //   items: [{
      //     title: "Domains",
      //     url: "/network/domains" as Route,
      //     icon: Globe,
      //     disabled: true,
      //   }]
      // }
    ] satisfies NavCategoryProps[],
  
  navMain: [
    {
      title: 'Containers',
      url: '/containers',
      icon: Container,
      isActive: true,
      items: [
        {
          title: 'List',
          url: '/containers' as const,
        },
        {
          title: 'Run',
          url: '/containers/run' as const,
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

interface NavItem {
  title: string;
  url: Route;
  icon: LucideIcon;
  disabled?: boolean;
}

interface NavCategoryProps {
  title: string;
  items: NavItem[];
}

export function NavCategory({ title, items }: NavCategoryProps) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className='inline-flex gap-1'>
        {title}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Link key={item.url} href={item.url} asChild>
            <SidebarMenuButton disabled={item.disabled} className="cursor-pointer">
              <item.icon /> {item.title} {item.disabled && <Badge variant='outline'>Coming soon</Badge>}
            </SidebarMenuButton>
          </Link>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
} 

export function AppSidebar({ user, onLogout, ...props }: React.ComponentProps<typeof Sidebar> & {
  user: {
    email: string
    name: string
    avatar: string
  }
  onLogout: () => unknown
}) {
  return (
    <Sidebar collapsible='icon' {...props}>
      <SidebarHeader>
        <AppSidebarLogo />
      </SidebarHeader>
      <SidebarContent>
        {data.categories.map((category) => (
          <NavCategory key={category.title} title={category.title} items={category.items} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
