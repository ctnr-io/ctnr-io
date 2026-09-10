import AuthLoginPage from 'app/components/ctnr-io/auth-login-page.tsx'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useExpoTrpcClientContext } from 'api/drivers/trpc/client/expo/mod.tsx'
import loginFromApp from 'api/handlers/client/auth/login_from_app.ts'
import { Redirect } from 'expo-router'

export default function AuthLoginScreen() {
  const ctx = useExpoTrpcClientContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const router = useRouter()

  const handleSignInGithub = async () => {
    setIsLoading(true)
    setError(undefined)
    try {
      // Use the new auth system
      const authGenerator = loginFromApp({ ctx, input: {} })

      // Process the auth flow
      for await (const message of authGenerator) {
        console.info(message)
      }

      // Redirect to main app after successful auth
      router.replace('/')
    } catch (error) {
      console.error('Authentication failed:', error)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }

  if (ctx.auth.session) {
    return <Redirect href='/' />
  }

  return <AuthLoginPage onSignInGithub={handleSignInGithub} isLoading={isLoading} error={error} />
}
