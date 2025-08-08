import { usePathname, useRouter } from 'expo-router'
import { Button, Image, ScrollView, Text, XStack, YStack } from 'tamagui'
import { CtnrColors } from '../constants/Colors.ts'
import { IconSymbol } from './ui/IconSymbol.tsx'

interface SidebarItem {
  id: string
  label: string
  icon: string
  route: string
  badge?: number
}

const sidebarItems: SidebarItem[] = [
  { id: 'containers', label: 'Containers', icon: 'cube.box', route: '/containers' },
  { id: 'volumes', label: 'Volumes', icon: 'externaldrive', route: '/volumes' },
  { id: 'domains', label: 'Domains', icon: 'globe', route: '/domains' },
  { id: 'routes', label: 'Routes', icon: 'arrow.triangle.branch', route: '/routes' },
  { id: 'resources', label: 'Resources', icon: 'cpu', route: '/resources' },
  { id: 'monitoring', label: 'Monitoring', icon: 'chart.line.uptrend.xyaxis', route: '/monitoring' },
  { id: 'billing', label: 'Billing', icon: 'creditcard', route: '/billing' },
  { id: 'notifications', label: 'Notifications', icon: 'bell', route: '/notifications', badge: 3 },
  { id: 'builds', label: 'Builds', icon: 'hammer', route: '/builds' },
  { id: 'deployments', label: 'Deployments', icon: 'arrow.up.circle', route: '/deployments' },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleItemPress = (route: string) => {
    router.push(route as any)
    onClose?.()
  }

  return (
    <YStack
      background="$secondary"
      width={280}
      height="100%"
      borderRightWidth={1}
      borderRightColor="$borderColor"
      display={isOpen ? 'flex' : 'none'}
      $gtMd={{
        display: 'flex',
      }}
    >
      {/* Logo Section */}
      <XStack
        paddingBlock="$4"
        verticalAlign="center"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        background="$secondary"
      >
        <Image
          source={require('../assets/images/ctnr-io/icons/browser.png')}
          width={32}
          height={32}
          marginEnd="$3"
        />
        <Text
          fontSize="$6"
          fontWeight="bold"
          color="$primary"
          fontFamily="$heading"
        >
          ctnr.io
        </Text>
      </XStack>

      {/* Navigation Items */}
      <ScrollView flex={1} paddingBlock="$2">
        <YStack space="$1">
          {sidebarItems.map((item) => {
            const isActive = pathname.startsWith(item.route)
            
            return (
              <Button
                key={item.id}
                unstyled
                onPress={() => handleItemPress(item.route)}
                background={isActive ? '$primary' : 'transparent'}
                style={{
                  borderRadius: 8,
                }}
                paddingBlock="$3"
                marginBlock="$1"
                pressStyle={{
                  background: isActive ? '$primary' : '$backgroundStrong',
                }}
                hoverStyle={{
                  background: isActive ? '$primary' : '$backgroundStrong',
                }}
              >
                <XStack verticalAlign="center" space="$3" flex={1}>
                  <IconSymbol
                    name={item.icon as any}
                    size={20}
                    color={isActive ? CtnrColors.white : CtnrColors.white}
                  />
                  <Text
                    flex={1}
                    fontSize="$4"
                    color={isActive ? CtnrColors.white : CtnrColors.white}
                    fontFamily="$body"
                  >
                    {item.label}
                  </Text>
                  {item.badge && (
                    <YStack
                      background="$error"
                      style={{ borderRadius: 10, minWidth: 20 }}
                      height={20}
                      verticalAlign="center"
                      justify="center"
                      paddingBlock="$2"
                    >
                      <Text
                        fontSize="$2"
                        color="white"
                        fontWeight="bold"
                      >
                        {item.badge}
                      </Text>
                    </YStack>
                  )}
                </XStack>
              </Button>
            )
          })}
        </YStack>
      </ScrollView>

      {/* Footer */}
      <YStack
        paddingBlock="$3"
        borderTopWidth={1}
        borderTopColor="$borderColor"
        background="$secondary"
      >
        <Text
          fontSize="$2"
          color={CtnrColors.textLight}
          fontFamily="$body"
        >
          v1.0.0
        </Text>
      </YStack>
    </YStack>
  )
}
