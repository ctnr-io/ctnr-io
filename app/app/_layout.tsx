// If using Expo Router, import your CSS file in the app/_layout.tsx file
import 'lib/env/app-env.ts'
import 'app/global.css'
import { Stack } from 'expo-router'
import { ExpoTrpcClientProvider } from 'api/drivers/trpc/client/expo/mod.tsx'
import AppLoadingPage from 'app/components/ctnr-io/app-loading-page.tsx'
import { AppLayout } from '../components/ctnr-io/app-layout.tsx'

export default function App() {
  return (
    <AppLayout>
      <ExpoTrpcClientProvider fallback={<AppLoadingPage />}>
        <Stack screenOptions={{ headerShown: false }} />
      </ExpoTrpcClientProvider>
    </AppLayout>
  )
}
