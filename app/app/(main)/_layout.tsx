import { Slot } from 'expo-router'
import { ExpoTrpcClientProvider, useExpoTrpcClientContext } from 'driver/trpc/client/expo/mod.tsx'
import logout from 'api/client/auth/logout.ts'
import AppLayout from 'app/components/ctnr-io/app-layout.tsx'
import { Redirect } from 'expo-router'

export default function MainLayout() {
  const ctx = useExpoTrpcClientContext()
  const handleLogout = async () => {
    await logout({ ctx })
  }
  if (!ctx.auth.session) {
    return <Redirect href='/login' />
  }
  return (
    <AppLayout user={ctx.auth.user!} onLogout={handleLogout}>
      <ExpoTrpcClientProvider>
        <main className="min-h-screen  bg-gradient-to-br from-background to-muted">
        <Slot />
        </main>
      </ExpoTrpcClientProvider>
    </AppLayout>
  )
}
