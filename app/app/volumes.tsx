import { Button, ScrollView, Text, XStack, YStack } from 'tamagui'
import { MainLayout } from '../components/MainLayout.tsx'
import { CreateButton, PageHeader, RefreshButton } from '../components/PageHeader.tsx'
import { IconSymbol } from '../components/ui/IconSymbol.tsx'
import { CtnrColors } from '../constants/Colors.ts'

interface Volume {
  id: string
  name: string
  size: string
  used: string
  mountPath: string
  status: 'active' | 'inactive' | 'error'
  created: string
  attachedTo?: string
}

function StatusBadge({ status }: { status: Volume['status'] }) {
  const statusConfig = {
    active: { color: CtnrColors.success, label: 'Active' },
    inactive: { color: CtnrColors.textLight, label: 'Inactive' },
    error: { color: CtnrColors.error, label: 'Error' },
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

function VolumeRow({ volume }: { volume: Volume }) {
  const usagePercentage = volume.used && volume.size 
    ? Math.round((parseFloat(volume.used) / parseFloat(volume.size)) * 100)
    : 0

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
      {/* Volume Icon & Name */}
      <XStack verticalAlign='center' space='$3' flex={1} style={{ minWidth: 200 }}>
        <YStack
          background='$primary'
          style={{ borderRadius: 8 }}
          width={40}
          height={40}
          verticalAlign='center'
          justify='center'
        >
          <IconSymbol name='externaldrive' size={20} color={CtnrColors.white} />
        </YStack>
        <YStack space='$1'>
          <Text fontSize='$4' fontWeight='600' color='$color' fontFamily='$body'>
            {volume.name}
          </Text>
          <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
            {volume.mountPath}
          </Text>
        </YStack>
      </XStack>

      {/* Status */}
      <YStack style={{ minWidth: 100 }} verticalAlign='center'>
        <StatusBadge status={volume.status} />
      </YStack>

      {/* Size & Usage */}
      <YStack style={{ minWidth: 120 }} space='$1'>
        <Text fontSize='$3' color='$color' fontFamily='$body'>
          {volume.size}
        </Text>
        <XStack verticalAlign='center' space='$2'>
          <YStack
            background='$borderColor'
            style={{ borderRadius: 4 }}
            height={4}
            width={60}
            overflow='hidden'
          >
            <YStack
              background={usagePercentage > 80 ? CtnrColors.error : CtnrColors.primary}
              height={4}
              width={`${usagePercentage}%`}
            />
          </YStack>
          <Text fontSize='$2' color={CtnrColors.textLight} fontFamily='$body'>
            {usagePercentage}%
          </Text>
        </XStack>
      </YStack>

      {/* Attached To */}
      <YStack style={{ minWidth: 120 }}>
        <Text fontSize='$3' color='$color' fontFamily='$body'>
          {volume.attachedTo || 'Not attached'}
        </Text>
      </YStack>

      {/* Created */}
      <YStack style={{ minWidth: 100 }}>
        <Text fontSize='$3' color={CtnrColors.textLight} fontFamily='$body'>
          {volume.created}
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
          <IconSymbol name='arrow.up.arrow.down' size={14} color={CtnrColors.primary} />
        </Button>
        <Button
          size='$2'
          background='transparent'
          borderWidth={1}
          borderColor='$borderColor'
          style={{ borderRadius: 6 }}
          pressStyle={{ background: '$backgroundStrong' }}
        >
          <IconSymbol name='trash' size={14} color={CtnrColors.error} />
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

export default function VolumesScreen() {
  const volumes: Volume[] = [
    {
      id: '1',
      name: 'database-storage',
      size: '50GB',
      used: '32GB',
      mountPath: '/var/lib/postgresql/data',
      status: 'active',
      created: '5 days ago',
      attachedTo: 'database',
    },
    {
      id: '2',
      name: 'app-logs',
      size: '10GB',
      used: '2.1GB',
      mountPath: '/app/logs',
      status: 'active',
      created: '3 days ago',
      attachedTo: 'web-app-prod',
    },
    {
      id: '3',
      name: 'redis-data',
      size: '5GB',
      used: '0.8GB',
      mountPath: '/data',
      status: 'inactive',
      created: '2 days ago',
      attachedTo: 'redis-cache',
    },
    {
      id: '4',
      name: 'backup-storage',
      size: '100GB',
      used: '45GB',
      mountPath: '/backups',
      status: 'active',
      created: '1 week ago',
    },
    {
      id: '5',
      name: 'temp-storage',
      size: '20GB',
      used: '18GB',
      mountPath: '/tmp',
      status: 'error',
      created: '1 day ago',
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title='Volumes'
        subtitle={`${volumes.length} volumes • ${volumes.filter(v => v.status === 'active').length} active`}
        icon='externaldrive'
        actions={
          <XStack space='$2'>
            <RefreshButton />
            <CreateButton label='New Volume' />
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
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' flex={1} style={{ minWidth: 200 }}>
            VOLUME
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' style={{ minWidth: 100 }}>
            STATUS
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' style={{ minWidth: 120 }}>
            SIZE & USAGE
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' style={{ minWidth: 120 }}>
            ATTACHED TO
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' style={{ minWidth: 100 }}>
            CREATED
          </Text>
          <Text fontSize='$3' fontWeight='600' color={CtnrColors.textLight} fontFamily='$body' style={{ minWidth: 120 }}>
            ACTIONS
          </Text>
        </XStack>

        {/* Volume List */}
        <ScrollView flex={1}>
          <YStack>
            {volumes.map((volume) => (
              <VolumeRow key={volume.id} volume={volume} />
            ))}
          </YStack>
        </ScrollView>
      </YStack>
    </MainLayout>
  )
}
