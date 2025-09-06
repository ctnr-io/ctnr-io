import { Slot } from 'expo-router'
import { ExpoTrpcClientProvider, useExpoTrpcClientContext } from 'driver/trpc/client/expo/mod.tsx'
import logout from 'api/client/auth/logout.ts'
import { Redirect } from 'expo-router'
import { AppSidebarLayout } from 'app/components/ctnr-io/app-sidebar-layout.tsx'

export default function MainLayout() {
  const ctx = useExpoTrpcClientContext()
  const handleLogout = async () => {
    await logout({ ctx })
  }
  if (!ctx.auth.session) {
    return <Redirect href='/login' />
  }

  return (
    <AppSidebarLayout user={ctx.auth.user!} onLogout={handleLogout}>
      <ExpoTrpcClientProvider>
        <Slot />
      </ExpoTrpcClientProvider>
    </AppSidebarLayout>
  )
}
