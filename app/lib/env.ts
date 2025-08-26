import process from 'node:process'
for (const [key, value] of Object.entries(process.env)) {
  if (!key.startsWith('EXPO_PUBLIC_')) {
    continue
  }
  process.env[key.replace('EXPO_PUBLIC_', '')] = value
}
