import { ScrollView, Text, XStack, YStack } from 'tamagui'
import { MainLayout } from '../components/MainLayout.tsx'
import { CreateButton, PageHeader, RefreshButton } from '../components/PageHeader.tsx'
import { IconSymbol } from '../components/ui/IconSymbol.tsx'
import { CtnrColors } from '../constants/Colors.ts'

interface DashboardCardProps {
  title: string
  value: string | number
  icon: string
  color?: string
  subtitle?: string
}

function DashboardCard({ title, value, icon, color = CtnrColors.primary, subtitle }: DashboardCardProps) {
  return (
    <YStack
      background='$background'
      style={{ borderRadius: 12,
				minWidth: 200,

			 }}
      paddingInline='$4'
      paddingBlock='$4'
      borderWidth={1}
      borderColor='$borderColor'
      gap='$3'
      flex={1}
    >
      <XStack verticalAlign='center' justify='space-between'>
        <YStack
          background={color}
          style={{ borderRadius: 8 }}
          width={40}
          height={40}
          verticalAlign='center'
          justify='center'
        >
          <IconSymbol name={icon as any} size={20} color={CtnrColors.white} />
        </YStack>
        <Text fontSize='$7' fontWeight='bold' color='$color' fontFamily='$heading'>
          {value}
        </Text>
      </XStack>
      <YStack space='$1'>
        <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
          {title}
        </Text>
        {subtitle && (
          <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
            {subtitle}
          </Text>
        )}
      </YStack>
    </YStack>
  )
}

interface RecentActivityItem {
  id: string
  type: 'container' | 'deployment' | 'build' | 'volume'
  title: string
  subtitle: string
  timestamp: string
  status: 'success' | 'error' | 'warning' | 'info'
}

function ActivityItem({ item }: { item: RecentActivityItem }) {
  const statusColors = {
    success: CtnrColors.success,
    error: CtnrColors.error,
    warning: CtnrColors.warning,
    info: CtnrColors.primary,
  }

  const typeIcons = {
    container: 'cube.box',
    deployment: 'arrow.up.circle',
    build: 'hammer',
    volume: 'externaldrive',
  }

  return (
    <XStack
      paddingInline='$4'
      paddingBlock='$3'
      verticalAlign='center'
      space='$3'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
    >
      <YStack
        background={statusColors[item.status]}
        style={{ borderRadius: 8 }}
        width={32}
        height={32}
        verticalAlign='center'
        justify='center'
      >
        <IconSymbol name={typeIcons[item.type] as any} size={16} color={CtnrColors.white} />
      </YStack>
      <YStack flex={1} space='$1'>
        <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
          {item.title}
        </Text>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          {item.subtitle}
        </Text>
      </YStack>
      <Text fontSize='$2' color={CtnrColors.textLight} fontFamily='$body'>
        {item.timestamp}
      </Text>
    </XStack>
  )
}

export default function DashboardScreen() {
  const dashboardData = [
    { title: 'Running Containers', value: 12, icon: 'cube.box', subtitle: '3 stopped' },
    { title: 'Active Deployments', value: 8, icon: 'arrow.up.circle', color: CtnrColors.success, subtitle: '2 pending' },
    { title: 'Storage Used', value: '2.4 GB', icon: 'externaldrive', color: CtnrColors.warning, subtitle: 'of 10 GB' },
    { title: 'Monthly Cost', value: '$24.50', icon: 'creditcard', color: CtnrColors.error, subtitle: 'this month' },
  ]

  const recentActivity: RecentActivityItem[] = [
    {
      id: '1',
      type: 'container',
      title: 'web-app-prod',
      subtitle: 'Container started successfully',
      timestamp: '2 min ago',
      status: 'success',
    },
    {
      id: '2',
      type: 'deployment',
      title: 'api-service v1.2.3',
      subtitle: 'Deployment completed',
      timestamp: '15 min ago',
      status: 'success',
    },
    {
      id: '3',
      type: 'build',
      title: 'frontend-build #142',
      subtitle: 'Build failed - check logs',
      timestamp: '1 hour ago',
      status: 'error',
    },
    {
      id: '4',
      type: 'volume',
      title: 'database-storage',
      subtitle: 'Volume resized to 50GB',
      timestamp: '2 hours ago',
      status: 'info',
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title='Dashboard'
        subtitle='Overview of your container infrastructure'
        icon='chart.bar'
        actions={
          <XStack space='$2'>
            <RefreshButton />
            <CreateButton label='New Container' />
          </XStack>
        }
      />

      <ScrollView flex={1}>
        <YStack paddingInline='$6' paddingBlock='$6' space='$6'>
          {/* Stats Cards */}
          <YStack space='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Overview
            </Text>
            <XStack space='$4' flexWrap='wrap'>
              {dashboardData.map((item, index) => (
                <DashboardCard key={index} {...item} />
              ))}
            </XStack>
          </YStack>

          {/* Recent Activity */}
          <YStack space='$4'>
            <XStack verticalAlign='center' justify='space-between'>
              <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
                Recent Activity
              </Text>
              <Text fontSize='$3' color={CtnrColors.primary} fontFamily='$body'>
                View all
              </Text>
            </XStack>
            <YStack
              background='$background'
              style={{ borderRadius: 12 }}
              borderWidth={1}
              borderColor='$borderColor'
              overflow='hidden'
            >
              {recentActivity.map((item) => (
                <ActivityItem key={item.id} item={item} />
              ))}
            </YStack>
          </YStack>

          {/* Quick Actions */}
          <YStack space='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Quick Actions
            </Text>
            <XStack space='$4' flexWrap='wrap'>
              <YStack
                background='$background'
                style={{ borderRadius: 12 }}
                paddingInline='$4'
                paddingBlock='$4'
                borderWidth={1}
                borderColor='$borderColor'
                space='$3'
                flex={1}
                minW={200}
                pressStyle={{ background: '$backgroundStrong' }}
              >
                <IconSymbol name='plus.circle' size={32} color={CtnrColors.primary} />
                <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
                  Deploy New App
                </Text>
                <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                  Start a new deployment
                </Text>
              </YStack>

              <YStack
                background='$background'
                style={{ borderRadius: 12, minWidth: 200 }}
                paddingInline='$4'
                paddingBlock='$4'
                borderWidth={1}
                borderColor='$borderColor'
                space='$3'
                flex={1}
                pressStyle={{ background: '$backgroundStrong' }}
              >
                <IconSymbol name='externaldrive.badge.plus' size={32} color={CtnrColors.success} />
                <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
                  Create Volume
                </Text>
                <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                  Add persistent storage
                </Text>
              </YStack>

              <YStack
                background='$background'
                style={{ borderRadius: 12, minWidth: 200 }}
                paddingInline='$4'
                paddingBlock='$4'
                borderWidth={1}
                borderColor='$borderColor'
                space='$3'
                flex={1}
                pressStyle={{ background: '$backgroundStrong' }}
              >
								{/* @ts-ignore */}
                <IconSymbol name='globe.badge.chevron.down' size={32} color={CtnrColors.warning} />
                <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
                  Setup Domain
                </Text>
                <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                  Configure custom domain
                </Text>
              </YStack>
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </MainLayout>
  )
}
