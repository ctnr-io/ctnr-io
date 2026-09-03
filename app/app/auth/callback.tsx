import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { Platform } from 'react-native'
import * as Linking from 'expo-linking'
import { handleAuthCallback } from 'api/handlers/client/auth/login_from_app.ts'
import { useExpoTrpcClientContext } from 'api/drivers/trpc/client/expo/mod.tsx'

export default function AuthCallback() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const ctx = useExpoTrpcClientContext()

  useEffect(() => {
    const processCallback = async () => {
      if (Platform.OS === 'web') {
        // Web environment - extract code from URL parameters
        const urlParams = new URLSearchParams(globalThis.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')

        if (error) {
          console.error('OAuth error:', error)
          router.replace('/(auth)/login')
          return
        }

        if (code) {
          // Complete the PKCE exchange on the mounted client (same storage that holds the
          // verifier). This establishes the session and fires onAuthStateChange, which refreshes
          // the app context.
          const { error: exchangeError } = await ctx.auth.client.exchangeCodeForSession(code)
          if (exchangeError) {
            console.error('Failed to exchange code for session:', exchangeError.message)
            router.replace('/(auth)/login')
            return
          }
          router.replace('/(main)/containers')
          return
        }

        router.replace('/(auth)/login')
      } else {
        // React Native environment (including Expo Go) - handle deep-link callback
        const code = params.code as string
        const error = params.error as string

        if (error) {
          console.error('OAuth error:', error)
          router.replace('/(auth)/login')
          return
        }

        if (code) {
          const callbackUrl = `ctnr-io://auth/callback?code=${code}`
          handleAuthCallback(callbackUrl)
          router.replace('/(main)/containers')
          return
        }

        // If we don't have code/error in params, try to get the current URL
        // This handles cases where the deep-link was opened directly
        try {
          const currentUrl = await Linking.getInitialURL()
          if (currentUrl) {
            const parsedUrl = Linking.parse(currentUrl)
            const urlCode = parsedUrl.queryParams?.code as string
            const urlError = parsedUrl.queryParams?.error as string

            if (urlError) {
              console.error('OAuth error from URL:', urlError)
              router.replace('/(auth)/login')
              return
            }

            if (urlCode) {
              const callbackUrl = `ctnr-io://auth/callback?code=${urlCode}`
              handleAuthCallback(callbackUrl)
              router.replace('/(main)/containers')
              return
            }
          }
        } catch (err) {
          console.warn('Could not parse initial URL:', err)
        }

        router.replace('/(auth)/login')
      }
    }

    processCallback()
  }, [router, params, ctx])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Processing authentication...</Text>
    </View>
  )
}
