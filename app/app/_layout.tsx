// If using Expo Router, import your CSS file in the app/_layout.tsx file
import 'app/global.css'
import { Stack } from 'expo-router'
import { ExpoTRPCClientProvider } from 'driver/trpc/client/expo/mod.tsx'

export default function AppLayout() {
  return (
    <ExpoTRPCClientProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ExpoTRPCClientProvider>
  )
}
