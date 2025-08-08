import { usePathname } from 'expo-router'
import React from 'react'
import { Button, Text, XStack, YStack } from 'tamagui'
import { CtnrColors } from '../constants/Colors.ts'
import { IconSymbol } from './ui/IconSymbol.tsx'

interface BreadcrumbItem {
  label: string
  route?: string
}

interface HeaderProps {
  onMenuToggle?: () => void
  showMenuButton?: boolean
}

export function Header({ onMenuToggle, showMenuButton = false }: HeaderProps) {
  const pathname = usePathname()

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []

    // Add project selector (placeholder for now)
    breadcrumbs.push({ label: 'My Project', route: '/projects' })

    // Map path segments to breadcrumb items
    if (segments.length > 0) {
      const mainSection = segments[0]
      const sectionLabels: Record<string, string> = {
        containers: 'Containers',
        volumes: 'Volumes',
        domains: 'Domains',
        routes: 'Routes',
        resources: 'Resources',
        monitoring: 'Monitoring',
        billing: 'Billing',
        notifications: 'Notifications',
        builds: 'Builds',
        deployments: 'Deployments',
      }

      if (sectionLabels[mainSection]) {
        breadcrumbs.push({
          label: sectionLabels[mainSection],
          route: `/${mainSection}`,
        })
      }

      // Add specific item if present (e.g., container ID, volume name)
      if (segments.length > 1) {
        breadcrumbs.push({
          label: segments[1],
          route: `/${segments[0]}/${segments[1]}`,
        })
      }

      // Add sub-section if present (e.g., logs, settings)
      if (segments.length > 2) {
        const subSectionLabels: Record<string, string> = {
          logs: 'Logs',
          settings: 'Settings',
          edit: 'Edit',
          create: 'Create',
          details: 'Details',
        }

        const subSection = segments[2]
        breadcrumbs.push({
          label: subSectionLabels[subSection] || subSection,
        })
      }
    }

    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <XStack
      background='$background'
      paddingInline='$4'
      paddingBlock='$3'
      borderBottomWidth={1}
      borderBottomColor='$borderColor'
      verticalAlign='center'
      justify='space-between'
      height={64}
    >
      {/* Left side - Menu button and Breadcrumbs */}
      <XStack verticalAlign='center' space='$3' flex={1}>
        {showMenuButton && (
          <Button
            unstyled
            onPress={onMenuToggle}
            paddingInline='$2'
            paddingBlock='$1'
            style={{ borderRadius: 8 }}
            pressStyle={{ background: '$backgroundStrong' }}
            hoverStyle={{ background: '$backgroundStrong' }}
          >
            <IconSymbol name='line.horizontal.3' size={20} color={CtnrColors.text} />
          </Button>
        )}

        {/* Breadcrumbs */}
        <XStack verticalAlign='center' space='$2'>
          {breadcrumbs.map((item, index) => (
            <XStack key={index} verticalAlign='center' space='$2'>
              {index > 0 && (
                <Text color={CtnrColors.textLight} fontSize='$3'>
                  /
                </Text>
              )}
              <Button
                unstyled
                disabled={!item.route}
                pressStyle={{ opacity: 0.7 }}
                hoverStyle={{ opacity: 0.8 }}
              >
                <Text
                  color={index === breadcrumbs.length - 1 ? CtnrColors.text : CtnrColors.primary}
                  fontSize='$4'
                  fontWeight={index === breadcrumbs.length - 1 ? 'bold' : 'normal'}
                  fontFamily='$body'
                >
                  {item.label}
                </Text>
              </Button>
            </XStack>
          ))}
        </XStack>
      </XStack>

      {/* Right side - User account section */}
      <XStack verticalAlign='center' space='$3'>
        {/* Notifications */}
        <Button
          unstyled
          paddingInline='$2'
          paddingBlock='$1'
          style={{ borderRadius: 8 }}
          pressStyle={{ background: '$backgroundStrong' }}
          hoverStyle={{ background: '$backgroundStrong' }}
        >
          <YStack position='relative'>
            <IconSymbol name='bell' size={20} color={CtnrColors.text} />
            {/* Notification badge */}
            <YStack
              position='absolute'
              style={{
                top: -2,
                right: -2,
                borderRadius: 6,
                minWidth: 12,
              }}
              background='$error'
              height={12}
              verticalAlign='center'
              justify='center'
            >
              <Text fontSize='$1' color='white' fontWeight='bold'>
                3
              </Text>
            </YStack>
          </YStack>
        </Button>

        {/* Settings */}
        <Button
          unstyled
          paddingInline='$2'
          paddingBlock='$1'
          style={{ borderRadius: 8 }}
          pressStyle={{ background: '$backgroundStrong' }}
          hoverStyle={{ background: '$backgroundStrong' }}
        >
          <IconSymbol name='gearshape' size={20} color={CtnrColors.text} />
        </Button>

        {/* User menu */}
        <Button
          unstyled
          paddingInline='$2'
          paddingBlock='$1'
          style={{ borderRadius: 8 }}
          pressStyle={{ background: '$backgroundStrong' }}
          hoverStyle={{ background: '$backgroundStrong' }}
        >
          <XStack verticalAlign='center' space='$2'>
            <YStack
              background='$primary'
              style={{ borderRadius: 16 }}
              width={32}
              height={32}
              verticalAlign='center'
              justify='center'
            >
              <Text color='white' fontSize='$3' fontWeight='bold'>
                U
              </Text>
            </YStack>
            <IconSymbol name='chevron.down' size={16} color={CtnrColors.text} />
          </XStack>
        </Button>
      </XStack>
    </XStack>
  )
}
