import { Slot } from 'expo-router'
import { useExpoTrpcClientContext } from 'driver/trpc/client/expo/mod.tsx'
import logout from 'api/client/auth/logout.ts'
import { useRouter } from 'expo-router'
import AppLayout from 'app/components/ctnr-io/app-layout.tsx'
import { Redirect } from 'expo-router'
import { router } from 'expo-router'

export default function MainLayout() {
  const ctx = useExpoTrpcClientContext()
  const handleLogout = async () => {
    await logout({ ctx })
  }
  if (!ctx.auth.session) {
    return <Redirect href='/login'  />
  }
  return (
    <AppLayout user={ctx.auth.user!} onLogout={handleLogout}>
      <Slot />
    </AppLayout>
  )
}
