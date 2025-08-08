import { Button, ScrollView, Text, XStack, YStack } from 'tamagui'
import { MainLayout } from '../components/MainLayout.tsx'
import { CreateButton, PageHeader, RefreshButton } from '../components/PageHeader.tsx'
import { IconSymbol } from '../components/ui/IconSymbol.tsx'
import { CtnrColors } from '../constants/Colors.ts'

interface Deployment {
  id: string
  name: string
  version: string
  status: 'deployed' | 'deploying' | 'failed' | 'pending'
  environment: 'production' | 'staging' | 'development'
  lastDeployed: string
  replicas: number
  image: string
}

function StatusBadge({ status }: { status: Deployment['status'] }) {
  const statusConfig = {
    deployed: { color: CtnrColors.success, label: 'Deployed' },
    deploying: { color: CtnrColors.warning, label: 'Deploying' },
    failed: { color: CtnrColors.error, label: 'Failed' },
    pending: { color: CtnrColors.textLight, label: 'Pending' },
  }

  const config = statusConfig[status]

  return (
    <XStack
      background={config.color}
      paddingInline='$2'
      paddingBlock='$1'
      style={{ borderRadius: 12 }}
      verticalAlign='center'
    >
      <Text fontSize='$2' color='white' fontWeight='600' fontFamily='$body'>
        {config.label}
      </Text>
    </XStack>
  )
}

function EnvironmentBadge({ environment }: { environment: Deployment['environment'] }) {
  const envConfig = {
    production: { color: CtnrColors.error, label: 'PROD' },
    staging: { color: CtnrColors.warning, label: 'STAGE' },
    development: { color: CtnrColors.primary, label: 'DEV' },
  }

  const config = envConfig[environment]

  return (
    <XStack
      background={config.color}
      paddingInline='$2'
      paddingBlock='$1'
      style={{ borderRadius: 8 }}
      verticalAlign='center'
    >
      <Text fontSize='$1' color='white' fontWeight='bold' fontFamily='$body'>
        {config.label}
      </Text>
    </XStack>
  )
}

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  return (
    <XStack
      paddingInline='$4'
      paddingBlock='$4'
      verticalAlign='center'
      gap='$4'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
      pressStyle={{ background: '$backgroundStrong' }}
    >
      {/* Deployment Icon & Name */}
      <XStack verticalAlign='center' gap='$3' flex={1} minW={200}>
        <YStack
          background='$primary'
          style={{ borderRadius: 8 }}
          width={40}
          height={40}
          verticalAlign='center'
          justify='center'
        >
          <IconSymbol name='arrow.up.circle' size={20} color={CtnrColors.white} />
        </YStack>
        <YStack gap='$1'>
          <XStack verticalAlign='center' gap='$2'>
            <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
              {deployment.name}
            </Text>
            <EnvironmentBadge environment={deployment.environment} />
          </XStack>
          <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
            {deployment.image}
          </Text>
        </YStack>
      </XStack>

      {/* Version */}
      <YStack minW={100}>
        <Text fontSize='$3' color='$color' fontFamily='$body'>
          {deployment.version}
        </Text>
      </YStack>

      {/* Status */}
      <YStack minW={100} verticalAlign='center'>
        <StatusBadge status={deployment.status} />
      </YStack>

      {/* Replicas */}
      <YStack minW={80}>
        <Text fontSize='$3' color='$color' fontFamily='$body'>
          {deployment.replicas} replicas
        </Text>
      </YStack>

      {/* Last Deployed */}
      <YStack minW={120}>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          {deployment.lastDeployed}
        </Text>
      </YStack>

      {/* Actions */}
      <XStack gap='$2'>
        <Button
          size='$2'
          background='transparent'
          borderWidth={1}
          borderColor='$borderColor'
          style={{ borderRadius: 6 }}
          pressStyle={{ background: '$backgroundStrong' }}
        >
          <IconSymbol name='arrow.clockwise' size={14} color={CtnrColors.primary} />
        </Button>
        <Button
          size='$2'
          background='transparent'
          borderWidth={1}
          borderColor='$borderColor'
          style={{ borderRadius: 6 }}
          pressStyle={{ background: '$backgroundStrong' }}
        >
          <IconSymbol name='stop.fill' size={14} color={CtnrColors.error} />
        </Button>
        <Button
          size='$2'
          background='transparent'
          borderWidth={1}
          borderColor='$borderColor'
          style={{ borderRadius: 6 }}
          pressStyle={{ background: '$backgroundStrong' }}
        >
          <IconSymbol name='ellipsis' size={14} color={CtnrColors.text} />
        </Button>
      </XStack>
    </XStack>
  )
}

export default function DeploymentsScreen() {
  const deployments: Deployment[] = [
    {
      id: '1',
      name: 'web-frontend',
      version: 'v2.1.3',
      status: 'deployed',
      environment: 'production',
      lastDeployed: '2 hours ago',
      replicas: 3,
      image: 'myapp/frontend:v2.1.3',
    },
    {
      id: '2',
      name: 'api-backend',
      version: 'v1.8.2',
      status: 'deployed',
      environment: 'production',
      lastDeployed: '1 day ago',
      replicas: 5,
      image: 'myapp/backend:v1.8.2',
    },
    {
      id: '3',
      name: 'worker-service',
      version: 'v1.2.1',
      status: 'deploying',
      environment: 'staging',
      lastDeployed: '5 min ago',
      replicas: 2,
      image: 'myapp/worker:v1.2.1',
    },
    {
      id: '4',
      name: 'auth-service',
      version: 'v0.9.0',
      status: 'failed',
      environment: 'development',
      lastDeployed: '30 min ago',
      replicas: 1,
      image: 'myapp/auth:v0.9.0',
    },
    {
      id: '5',
      name: 'notification-service',
      version: 'v1.0.0',
      status: 'pending',
      environment: 'staging',
      lastDeployed: 'Never',
      replicas: 2,
      image: 'myapp/notifications:v1.0.0',
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title='Deployments'
        subtitle={`${deployments.length} deployments • ${
          deployments.filter((d) => d.status === 'deployed').length
        } active`}
        icon='arrow.up.circle'
        actions={
          <XStack gap='$2'>
            <RefreshButton />
            <CreateButton label='New Deployment' />
          </XStack>
        }
      />

      <YStack flex={1} background='$background'>
        {/* Environment Filter */}
        <XStack
          paddingInline='$4'
          paddingBlock='$3'
          gap='$3'
          borderBottomWidth={1}
          borderBottomColor='$borderColor'
          background='$backgroundStrong'
        >
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body'>
            Filter by environment:
          </Text>
          <Button
            size='$2'
            background='$primary'
            color='white'
            style={{ borderRadius: 6 }}
          >
            <Text fontSize='$2' color='white' fontFamily='$body'>All</Text>
          </Button>
          <Button
            size='$2'
            background='transparent'
            borderWidth={1}
            borderColor='$borderColor'
            style={{ borderRadius: 6 }}
          >
            <Text fontSize='$2' color='$color' fontFamily='$body'>Production</Text>
          </Button>
          <Button
            size='$2'
            background='transparent'
            borderWidth={1}
            borderColor='$borderColor'
            style={{ borderRadius: 6 }}
          >
            <Text fontSize='$2' color='$color' fontFamily='$body'>Staging</Text>
          </Button>
          <Button
            size='$2'
            background='transparent'
            borderWidth={1}
            borderColor='$borderColor'
            style={{ borderRadius: 6 }}
          >
            <Text fontSize='$2' color='$color' fontFamily='$body'>Development</Text>
          </Button>
        </XStack>

        {/* Table Header */}
        <XStack
          paddingInline='$4'
          paddingBlock='$3'
          borderBottomWidth={1}
          borderBottomColor='$borderColor'
          background='$backgroundStrong'
        >
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' flex={1} minW={200}>
            DEPLOYMENT
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
            VERSION
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
            STATUS
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={80}>
            REPLICAS
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={120}>
            LAST DEPLOYED
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={120}>
            ACTIONS
          </Text>
        </XStack>

        {/* Deployment List */}
        <ScrollView flex={1}>
          <YStack>
            {deployments.map((deployment) => <DeploymentRow key={deployment.id} deployment={deployment} />)}
          </YStack>
        </ScrollView>
      </YStack>
    </MainLayout>
  )
}
