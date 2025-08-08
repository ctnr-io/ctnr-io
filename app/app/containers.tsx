import { Button, ScrollView, Text, XStack, YStack } from 'tamagui'
import { MainLayout } from '../components/MainLayout.tsx'
import { CreateButton, PageHeader, RefreshButton } from '../components/PageHeader.tsx'
import { IconSymbol } from '../components/ui/IconSymbol.tsx'
import { CtnrColors } from '../constants/Colors.ts'

interface Container {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'error' | 'starting'
  ports: string[]
  created: string
  cpu: string
  memory: string
}

function StatusBadge({ status }: { status: Container['status'] }) {
  const statusConfig = {
    running: { color: CtnrColors.success, label: 'Running' },
    stopped: { color: CtnrColors.textLight, label: 'Stopped' },
    error: { color: CtnrColors.error, label: 'Error' },
    starting: { color: CtnrColors.warning, label: 'Starting' },
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

function ContainerRow({ container }: { container: Container }) {
  return (
    <XStack
      paddingInline='$4'
      paddingBlock='$4'
      verticalAlign='center'
      space='$4'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
      pressStyle={{ background: '$backgroundStrong' }}
    >
      {/* Container Icon & Name */}
      <XStack verticalAlign='center' space='$3' flex={1} minW={200}>
        <YStack
          background='$primary'
          style={{ borderRadius: 8 }}
          width={40}
          height={40}
          verticalAlign='center'
          justify='center'
        >
          <IconSymbol name='cube.box' size={20} color={CtnrColors.white} />
        </YStack>
        <YStack space='$1'>
          <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
            {container.name}
          </Text>
          <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
            {container.image}
          </Text>
        </YStack>
      </XStack>

      {/* Status */}
      <YStack minW={100} verticalAlign='center'>
        <StatusBadge status={container.status} />
      </YStack>

      {/* Ports */}
      <YStack minW={120} space='$1'>
        <Text fontSize='$3' color='$color' fontFamily='$body'>
          {container.ports.length > 0 ? container.ports.join(', ') : 'No ports'}
        </Text>
      </YStack>

      {/* Resources */}
      <YStack minW={100} space='$1'>
        <Text fontSize='$3' color='$color' fontFamily='$body'>
          CPU: {container.cpu}
        </Text>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          RAM: {container.memory}
        </Text>
      </YStack>

      {/* Created */}
      <YStack minW={100}>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          {container.created}
        </Text>
      </YStack>

      {/* Actions */}
      <XStack space='$2'>
        <Button
          size='$2'
          background='transparent'
          borderWidth={1}
          borderColor='$borderColor'
          style={{ borderRadius: 6 }}
          pressStyle={{ background: '$backgroundStrong' }}
        >
          <IconSymbol name='play.fill' size={14} color={CtnrColors.success} />
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

export default function ContainersScreen() {
  const containers: Container[] = [
    {
      id: '1',
      name: 'web-app-prod',
      image: 'nginx:1.21-alpine',
      status: 'running',
      ports: ['80:8080', '443:8443'],
      created: '2 days ago',
      cpu: '12%',
      memory: '256MB',
    },
    {
      id: '2',
      name: 'api-service',
      image: 'node:18-alpine',
      status: 'running',
      ports: ['3000:3000'],
      created: '1 day ago',
      cpu: '8%',
      memory: '512MB',
    },
    {
      id: '3',
      name: 'database',
      image: 'postgres:14',
      status: 'running',
      ports: ['5432:5432'],
      created: '5 days ago',
      cpu: '5%',
      memory: '1GB',
    },
    {
      id: '4',
      name: 'redis-cache',
      image: 'redis:7-alpine',
      status: 'stopped',
      ports: ['6379:6379'],
      created: '3 days ago',
      cpu: '0%',
      memory: '0MB',
    },
    {
      id: '5',
      name: 'worker-queue',
      image: 'python:3.11-slim',
      status: 'error',
      ports: [],
      created: '1 hour ago',
      cpu: '0%',
      memory: '0MB',
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title='Containers'
        subtitle={`${containers.length} containers • ${containers.filter(c => c.status === 'running').length} running`}
        icon='cube.box'
        actions={
          <XStack space='$2'>
            <RefreshButton />
            <CreateButton label='New Container' />
          </XStack>
        }
      />

      <YStack flex={1} background='$background'>
        {/* Table Header */}
        <XStack
          paddingInline='$4'
          paddingBlock='$3'
          borderBottomWidth={1}
          borderBottomColor='$borderColor'
          background='$backgroundStrong'
        >
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' flex={1} minW={200}>
            CONTAINER
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
            STATUS
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={120}>
            PORTS
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
            RESOURCES
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={100}>
            CREATED
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' minW={120}>
            ACTIONS
          </Text>
        </XStack>

        {/* Container List */}
        <ScrollView flex={1}>
          <YStack>
            {containers.map((container) => (
              <ContainerRow key={container.id} container={container} />
            ))}
          </YStack>
        </ScrollView>
      </YStack>
    </MainLayout>
  )
}
