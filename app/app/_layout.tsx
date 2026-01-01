// If using Expo Router, import your CSS file in the app/_layout.tsx file
import 'lib/env/app-env.ts'
import 'app/global.css'
import { Stack } from 'expo-router'
import { ExpoTrpcClientProvider } from 'api/drivers/trpc/client/expo/mod.tsx'
import AppLoadingPage from 'app/components/ctnr-io/app-loading-page.tsx'
import AppErrorPage from 'app/components/ctnr-io/app-error-page.tsx'
import { AppLayout } from '../components/ctnr-io/app-layout.tsx'
import { ClientAuthError, ClientVersionError } from 'api/drivers/errors.ts'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'

export default function App() {
  const router = useRouter()
  return (
    <AppLayout>
      <ExpoTrpcClientProvider
        fallback={({ error }: { error: Error | null }) => {
          switch (true) {
            case error === null: 
              return <AppLoadingPage />

            case error instanceof ClientVersionError: 
              // Show update required screen
              // If web, reload the page
              if (Platform.OS === 'web') {
                globalThis.location.reload()
              } else {
                // TODO: implement upgrade flow for mobile
                console.error('Please update the app to the latest version.')
              }
              return <AppLoadingPage />

            case error instanceof ClientAuthError:
              // Show login screen
              router.navigate('/login')
              return <Stack screenOptions={{ headerShown: false }} />

            case error instanceof Error: 
            default: 
              // Show generic error screen
              return <AppErrorPage 
                title='Something went wrong'
                description='An unexpected error occurred. Please try again later.'
                actionLabel='Reload'
                onAction={() => {
                  if (Platform.OS === 'web') {
                    globalThis.location.reload()
                  } else {
                    router.replace('/')
                  }
                }}
              />
          }
        }}
      >
        <Stack screenOptions={{ headerShown: false }} />
      </ExpoTrpcClientProvider>
    </AppLayout>
  )
}
