import process from 'node:process'
import Constants from 'expo-constants'

// Polyfill process.env for Expo

for (const [key, value] of Object.entries(Constants.manifest?.extra || {})) {
  // @ts-ignore
  process.env[key] = value
}