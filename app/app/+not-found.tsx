import { Link, Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import { ThemedText } from 'app/components/ThemedText.tsx'
import { ThemedView } from 'app/components/ThemedView.tsx'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ThemedView style={styles.container}>
        <ThemedText type='title'>This page does not exist.</ThemedText>
        <Link href='/' style={styles.link}>
          <ThemedText type='link'>Go to home!</ThemedText>
        </Link>
      </ThemedView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
})
