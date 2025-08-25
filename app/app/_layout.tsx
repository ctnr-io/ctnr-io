// If using Expo Router, import your CSS file in the app/_layout.tsx file
import 'app/lib/env.ts'
import 'app/global.css'
import { Stack } from 'expo-router'
import { ExpoTrpcClientProvider } from 'driver/trpc/client/expo/mod.tsx'

export default function App() {
  return (
    <ExpoTrpcClientProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ExpoTrpcClientProvider>
  )
}
