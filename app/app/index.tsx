import { Redirect } from 'expo-router'
import { useExpoTrpcClientContext } from 'api/drivers/trpc/client/expo/mod.tsx'

export default function AppIndex() {
  const ctx = useExpoTrpcClientContext()
  if (ctx.auth.session) {
    return <Redirect href='/containers' />
  } else {
    return <Redirect href='/(auth)/login' />
  }
}
