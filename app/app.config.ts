import { ExpoConfig } from '@expo/config'

const config: ExpoConfig = {
  name: 'ctnr.io',
  slug: 'ctnr-io',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'ctnr-io',
  extra: {
    githubClientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || 'Iv23lidn21XPbJZJYhet',
  },
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'io.ctnr.app',
    icon: './assets/images/ctnr-io/icons/iphone.png',
    supportsTablet: true,
  },
  android: {
    package: 'io.ctnr.app',
    icon: './assets/images/ctnr-io/icons/android.png',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/ctnr-io/icons/browser.png',
    shortName: 'ctnr.io',
    name: 'ctnr.io',
    description: 'ctnr.io - Cloud made simple.',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/ctnr-io/splash.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
}

export default config
