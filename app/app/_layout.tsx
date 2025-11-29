// If using Expo Router, import your CSS file in the app/_layout.tsx file
import '../../lib/env/expo-env.ts'
import 'app/global.css'
import { Stack } from 'expo-router'
import { ExpoTrpcClientProvider } from 'api/drivers/trpc/client/expo/mod.tsx'

export default function App() {
  return (
    <ExpoTrpcClientProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ExpoTrpcClientProvider>
  )
}
