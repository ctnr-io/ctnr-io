import process from 'node:process'
import Constants from 'expo-constants'

// Polyfill process.env for Expo

for (const [key, value] of Object.entries(Constants.manifest?.extra || {})) {
  // @ts-ignore: dynamic key assignment on process.env
  process.env[key] = value
}

// Per-preview runtime override: /env.js sets globalThis.__CTNR_ENV__ before the
// bundle loads, letting one prebuilt image target a per-PR api without a rebuild.
// @ts-ignore: __CTNR_ENV__ is set by /env.js, not declared on globalThis
const runtimeEnv = globalThis.__CTNR_ENV__ || {}
for (const [key, value] of Object.entries(runtimeEnv)) {
  if (value != null && value !== '') {
    // @ts-ignore: dynamic key assignment on process.env
    process.env[key] = value
  }
}
