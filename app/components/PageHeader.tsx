import { Button, Text, XStack, YStack } from 'tamagui'
import { CtnrColors } from '../constants/Colors.ts'
import { IconSymbol } from './ui/IconSymbol.tsx'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  icon?: string
}

export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <YStack
      paddingInline='$6'
      paddingBlock='$4'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
      background='$background'
    >
      <XStack verticalAlign='center' justify='space-between'>
        {/* Title section */}
        <XStack verticalAlign='center' space='$3' flex={1}>
          {icon && (
            <YStack
              background='$primary'
              style={{ borderRadius: 12 }}
              width={48}
              height={48}
              verticalAlign='center'
              justify='center'
            >
              <IconSymbol name={icon as any} size={24} color={CtnrColors.white} />
            </YStack>
          )}
          <YStack space='$1'>
            <Text
              fontSize='$8'
              fontWeight='bold'
              color='$color'
              fontFamily='$heading'
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                fontSize='$4'
                color={CtnrColors.textLight}
                fontFamily='$body'
              >
                {subtitle}
              </Text>
            )}
          </YStack>
        </XStack>

        {/* Actions section */}
        {actions && (
          <XStack space='$2'>
            {actions}
          </XStack>
        )}
      </XStack>
    </YStack>
  )
}

// Common action buttons for reuse
export function CreateButton({ onPress, label = 'Create' }: { onPress?: () => void; label?: string }) {
  return (
    <Button
      background='$primary'
      color='white'
      paddingInline='$4'
      paddingBlock='$2'
      style={{ borderRadius: 8 }}
      pressStyle={{ opacity: 0.8 }}
      hoverStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <XStack verticalAlign='center' space='$2'>
        <IconSymbol name='plus' size={16} color={CtnrColors.white} />
        <Text color='white' fontWeight='600' fontFamily='$body'>
          {label}
        </Text>
      </XStack>
    </Button>
  )
}

export function RefreshButton({ onPress }: { onPress?: () => void }) {
  return (
    <Button
      background='transparent'
      borderWidth={1}
      borderColor='$borderColor'
      color='$color'
      paddingInline='$3'
      paddingBlock='$2'
      style={{ borderRadius: 8 }}
      pressStyle={{ background: '$backgroundStrong' }}
      hoverStyle={{ background: '$backgroundStrong' }}
      onPress={onPress}
    >
      <IconSymbol name='arrow.clockwise' size={16} color={CtnrColors.text} />
    </Button>
  )
}
