import { Stack } from 'expo-router'
import AppErrorPage from 'app/components/ctnr-io/app-error-page.tsx'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <AppErrorPage
        title='Page not found'
        description='This page does not exist.'
        actionLabel='Go to home'
      />
    </>
  )
}
