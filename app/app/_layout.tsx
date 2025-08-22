// If using Expo Router, import your CSS file in the app/_layout.tsx file
import 'app/lib/env.ts'
import 'app/global.css'
import { ExpoTrpcClientProvider } from 'driver/trpc/client/expo/mod.tsx'
import { Slot } from 'expo-router'

export default function App() {
  return (
    <ExpoTrpcClientProvider>
      <Slot />
    </ExpoTrpcClientProvider>
  )
}
