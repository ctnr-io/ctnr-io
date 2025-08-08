import { useState } from 'react'
import { Platform } from 'react-native'
import { XStack, YStack } from 'tamagui'
import { Header } from './Header.tsx'
import { Sidebar } from './Sidebar.tsx'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  return (
    <YStack flex={1} background='$backgroundStrong'>
      {/* Header */}
      <Header 
        onMenuToggle={toggleSidebar}
        showMenuButton={Platform.OS !== 'web' || true} // Show on mobile or when needed
      />
      
      {/* Main content area */}
      <XStack flex={1}>
        {/* Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen}
          onClose={closeSidebar}
        />
        
        {/* Main content */}
        <YStack 
          flex={1} 
          background='$background'
          overflow='hidden'
        >
          {children}
        </YStack>
      </XStack>
    </YStack>
  )
}
