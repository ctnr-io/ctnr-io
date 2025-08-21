import AuthLoginPage from 'app/components/ctnr-io/auth-login-page.tsx'
import { useTRPCClient } from 'driver/trpc/client/expo/mod.tsx'

export default function AuthLoginScreen() {
  const trpc = useTRPCClient()
  return <AuthLoginPage onSignInGithub={trpc} />
}
