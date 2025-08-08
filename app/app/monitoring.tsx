import { ScrollView, Text, XStack, YStack } from 'tamagui'
import { MainLayout } from '../components/MainLayout.tsx'
import { CreateButton, PageHeader, RefreshButton } from '../components/PageHeader.tsx'
import { IconSymbol } from '../components/ui/IconSymbol.tsx'
import { CtnrColors } from '../constants/Colors.ts'

interface MetricCard {
  title: string
  value: string
  change: string
  trend: 'up' | 'down' | 'stable'
  icon: string
}

function MetricCard({ title, value, change, trend, icon }: MetricCard) {
  const trendColors = {
    up: CtnrColors.success,
    down: CtnrColors.error,
    stable: CtnrColors.textLight,
  }

  const trendIcons = {
    up: 'arrow.up',
    down: 'arrow.down',
    stable: 'minus',
  }

  return (
    <YStack
      background='$background'
      style={{ borderRadius: 12 }}
      paddingInline='$4'
      paddingBlock='$4'
      borderWidth={1}
      borderColor='$borderColor'
      gap='$3'
      flex={1}
      minW={200}
    >
      <XStack verticalAlign='center' justify='space-between'>
        <YStack
          background='$primary'
          style={{ borderRadius: 8 }}
          width={40}
          height={40}
          verticalAlign='center'
          justify='center'
        >
          <IconSymbol name={icon as any} size={20} color={CtnrColors.white} />
        </YStack>
        <XStack verticalAlign='center' gap='$1'>
          <IconSymbol name={trendIcons[trend] as any} size={12} color={trendColors[trend]} />
          <Text fontSize='$2' color={trendColors[trend]} fontFamily='$body'>
            {change}
          </Text>
        </XStack>
      </XStack>
      <YStack gap='$1'>
        <Text fontSize='$7' fontWeight='bold' color='$color' fontFamily='$heading'>
          {value}
        </Text>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          {title}
        </Text>
      </YStack>
    </YStack>
  )
}

interface Alert {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  message: string
  timestamp: string
  source: string
}

function AlertItem({ alert }: { alert: Alert }) {
  const alertColors = {
    critical: CtnrColors.error,
    warning: CtnrColors.warning,
    info: CtnrColors.primary,
  }

  const alertIcons = {
    critical: 'exclamationmark.triangle.fill',
    warning: 'exclamationmark.triangle',
    info: 'info.circle',
  }

  return (
    <XStack
      paddingInline='$4'
      paddingBlock='$3'
      verticalAlign='center'
      gap='$3'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
      pressStyle={{ background: '$backgroundStrong' }}
    >
      <YStack
        background={alertColors[alert.type]}
        style={{ borderRadius: 8 }}
        width={32}
        height={32}
        verticalAlign='center'
        justify='center'
      >
        <IconSymbol name={alertIcons[alert.type] as any} size={16} color={CtnrColors.white} />
      </YStack>
      <YStack flex={1} gap='$1'>
        <XStack verticalAlign='center' justify='space-between'>
          <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
            {alert.title}
          </Text>
          <Text fontSize='$2' color={CtnrColors.textLight} fontFamily='$body'>
            {alert.timestamp}
          </Text>
        </XStack>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          {alert.message}
        </Text>
        <Text fontSize='$2' color={CtnrColors.primary} fontFamily='$body'>
          {alert.source}
        </Text>
      </YStack>
    </XStack>
  )
}

export default function MonitoringScreen() {
  const metrics: MetricCard[] = [
    { title: 'CPU Usage', value: '45%', change: '+2.3%', trend: 'up', icon: 'cpu' },
    { title: 'Memory Usage', value: '2.1GB', change: '-0.5GB', trend: 'down', icon: 'memorychip' },
    { title: 'Network I/O', value: '1.2MB/s', change: '+0.3MB/s', trend: 'up', icon: 'network' },
    { title: 'Disk Usage', value: '67%', change: '0%', trend: 'stable', icon: 'externaldrive' },
  ]

  const alerts: Alert[] = [
    {
      id: '1',
      type: 'critical',
      title: 'High Memory Usage',
      message: 'Container web-app-prod is using 95% of allocated memory',
      timestamp: '2 min ago',
      source: 'web-app-prod',
    },
    {
      id: '2',
      type: 'warning',
      title: 'Disk Space Low',
      message: 'Volume database-storage is 85% full',
      timestamp: '15 min ago',
      source: 'database-storage',
    },
    {
      id: '3',
      type: 'info',
      title: 'Container Restarted',
      message: 'Container api-service was automatically restarted',
      timestamp: '1 hour ago',
      source: 'api-service',
    },
    {
      id: '4',
      type: 'warning',
      title: 'High CPU Usage',
      message: 'CPU usage has been above 80% for 10 minutes',
      timestamp: '2 hours ago',
      source: 'worker-queue',
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title='Monitoring'
        subtitle='Real-time metrics and alerts for your infrastructure'
        icon='chart.line.uptrend.xyaxis'
        actions={
          <XStack gap='$2'>
            <RefreshButton />
            <CreateButton label='New Alert Rule' />
          </XStack>
        }
      />

      <ScrollView flex={1}>
        <YStack paddingInline='$6' paddingBlock='$6' gap='$6'>
          {/* Metrics Cards */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              System Metrics
            </Text>
            <XStack gap='$4' flexWrap='wrap'>
              {metrics.map((metric, index) => (
                <MetricCard key={index} {...metric} />
              ))}
            </XStack>
          </YStack>

          {/* Resource Usage Chart Placeholder */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Resource Usage (Last 24h)
            </Text>
            <YStack
              background='$background'
              style={{ borderRadius: 12 }}
              paddingInline='$4'
              paddingBlock='$6'
              borderWidth={1}
              borderColor='$borderColor'
              verticalAlign='center'
              justify='center'
              height={200}
            >
              <IconSymbol name='chart.line.uptrend.xyaxis' size={48} color={CtnrColors.textLight} />
              <Text fontSize='$4' color={CtnrColors.textLight} fontFamily='$body' text='center'>
                Chart visualization would go here
              </Text>
            </YStack>
          </YStack>

          {/* Active Alerts */}
          <YStack gap='$4'>
            <XStack verticalAlign='center' justify='space-between'>
              <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
                Active Alerts
              </Text>
              <XStack verticalAlign='center' gap='$2'>
                <YStack
                  background={CtnrColors.error}
                  style={{ borderRadius: 6 }}
                  width={12}
                  height={12}
                />
                <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                  {alerts.filter(a => a.type === 'critical').length} Critical
                </Text>
                <YStack
                  background={CtnrColors.warning}
                  style={{ borderRadius: 6 }}
                  width={12}
                  height={12}
                />
                <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                  {alerts.filter(a => a.type === 'warning').length} Warning
                </Text>
              </XStack>
            </XStack>
            <YStack
              background='$background'
              style={{ borderRadius: 12 }}
              borderWidth={1}
              borderColor='$borderColor'
              overflow='hidden'
            >
              {alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </YStack>
          </YStack>

          {/* Container Health */}
          <YStack gap='$4'>
            <Text fontSize='$6' fontWeight='bold' color='$color' fontFamily='$heading'>
              Container Health
            </Text>
            <XStack gap='$4' flexWrap='wrap'>
              <YStack
                background='$background'
                style={{ borderRadius: 12 }}
                paddingInline='$4'
                paddingBlock='$4'
                borderWidth={1}
                borderColor='$borderColor'
                gap='$3'
                flex={1}
                minW={200}
              >
                <XStack verticalAlign='center' gap='$3'>
                  <YStack
                    background={CtnrColors.success}
                    style={{ borderRadius: 8 }}
                    width={40}
                    height={40}
                    verticalAlign='center'
                    justify='center'
                  >
                    <IconSymbol name='checkmark.circle.fill' size={20} color={CtnrColors.white} />
                  </YStack>
                  <YStack gap='$1'>
                    <Text fontSize='$5' fontWeight='bold' color='$color' fontFamily='$heading'>
                      3
                    </Text>
                    <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                      Healthy Containers
                    </Text>
                  </YStack>
                </XStack>
              </YStack>

              <YStack
                background='$background'
                style={{ borderRadius: 12 }}
                paddingInline='$4'
                paddingBlock='$4'
                borderWidth={1}
                borderColor='$borderColor'
                gap='$3'
                flex={1}
                minW={200}
              >
                <XStack verticalAlign='center' gap='$3'>
                  <YStack
                    background={CtnrColors.warning}
                    style={{ borderRadius: 8 }}
                    width={40}
                    height={40}
                    verticalAlign='center'
                    justify='center'
                  >
                    <IconSymbol name='exclamationmark.triangle.fill' size={20} color={CtnrColors.white} />
                  </YStack>
                  <YStack gap='$1'>
                    <Text fontSize='$5' fontWeight='bold' color='$color' fontFamily='$heading'>
                      1
                    </Text>
                    <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                      Warning Containers
                    </Text>
                  </YStack>
                </XStack>
              </YStack>

              <YStack
                background='$background'
                style={{ borderRadius: 12 }}
                paddingInline='$4'
                paddingBlock='$4'
                borderWidth={1}
                borderColor='$borderColor'
                gap='$3'
                flex={1}
                minW={200}
              >
                <XStack verticalAlign='center' gap='$3'>
                  <YStack
                    background={CtnrColors.error}
                    style={{ borderRadius: 8 }}
                    width={40}
                    height={40}
                    verticalAlign='center'
                    justify='center'
                  >
                    <IconSymbol name='xmark.circle.fill' size={20} color={CtnrColors.white} />
                  </YStack>
                  <YStack gap='$1'>
                    <Text fontSize='$5' fontWeight='bold' color='$color' fontFamily='$heading'>
                      1
                    </Text>
                    <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
                      Failed Containers
                    </Text>
                  </YStack>
                </XStack>
              </YStack>
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </MainLayout>
  )
}
