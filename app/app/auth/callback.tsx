import { useEffect } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { Platform } from 'react-native'
import * as Linking from 'expo-linking'
import { handleAuthCallback } from 'api/handlers/client/auth/login_from_app.ts'

export default function AuthCallback() {
  const router = useRouter()
  const params = useLocalSearchParams()

  useEffect(() => {
    const processCallback = async () => {
      if (Platform.OS === 'web') {
        // Web environment - extract code from URL parameters
        const urlParams = new URLSearchParams(globalThis.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')

        if (error) {
          console.error('OAuth error:', error)
          // Redirect to login with error
          router.replace('/(auth)/login')
          return
        }

        if (code) {
          // Notify the login-from-app handler about the callback
          const callbackUrl = `ctnr-io://auth/callback?code=${code}`
          handleAuthCallback(callbackUrl)

          // Store the code temporarily and redirect to main app
          // The auth handler will pick this up
          sessionStorage.setItem('oauth_code', code)
          router.replace('/(main)/containers')
          return
        }

        // No code or error, redirect to login
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
          // Construct the callback URL for the handler
          const callbackUrl = `ctnr-io://auth/callback?code=${code}`
          handleAuthCallback(callbackUrl)

          // Redirect to the main app
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

        // No valid callback data found, redirect to login
        router.replace('/(auth)/login')
      }
    }

    processCallback()
  }, [router, params])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Processing authentication...</Text>
    </View>
  )
}
