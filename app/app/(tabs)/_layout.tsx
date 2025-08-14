import { Tabs } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'

import { HapticTab } from 'app/components/expo/HapticTab.tsx'
import { IconSymbol } from 'app/components/expo/ui/IconSymbol.tsx'
import TabBarBackground from 'app/components/expo/ui/TabBarBackground.tsx'
import { Colors } from 'app/constants/Colors.ts'
import { useColorScheme } from 'app/hooks/useColorScheme.ts'

export default function TabLayout() {
  const colorScheme = useColorScheme()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name='house.fill' color={color} />,
        }}
      />
      <Tabs.Screen
        name='explore'
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name='paperplane.fill' color={color} />,
        }}
      />
    </Tabs>
  )
}
