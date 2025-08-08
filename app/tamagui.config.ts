import { defaultConfig } from '@tamagui/config/v4'
import { createTamagui } from 'tamagui'
import { CtnrColors } from './constants/Colors.ts'

export const config = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      primary: CtnrColors.primary,
      secondary: CtnrColors.secondary,
      background: CtnrColors.white,
      backgroundStrong: CtnrColors.background,
      color: CtnrColors.text,
      colorPress: CtnrColors.textLight,
      borderColor: CtnrColors.border,
      success: CtnrColors.success,
      error: CtnrColors.error,
      warning: CtnrColors.warning,
    },
    dark: {
      ...defaultConfig.themes.dark,
      primary: CtnrColors.primary,
      secondary: CtnrColors.secondary,
      background: CtnrColors.secondary,
      backgroundStrong: '#2a2f36',
      color: CtnrColors.white,
      colorPress: '#cccccc',
      borderColor: '#555555',
      success: CtnrColors.success,
      error: CtnrColors.error,
      warning: CtnrColors.warning,
    },
  },
  fonts: {
    ...defaultConfig.fonts,
    heading: {
      family: 'Biko Bold, Croogla Bold, system-ui, sans-serif',
      size: defaultConfig.fonts.heading?.size || {},
      lineHeight: defaultConfig.fonts.heading?.lineHeight || {},
      weight: defaultConfig.fonts.heading?.weight || {},
      letterSpacing: defaultConfig.fonts.heading?.letterSpacing || {},
      face: defaultConfig.fonts.heading?.face || {},
    },
    body: {
      family: 'Biko Bold, Croogla Bold, system-ui, sans-serif',
      size: defaultConfig.fonts.body?.size || {},
      lineHeight: defaultConfig.fonts.body?.lineHeight || {},
      weight: defaultConfig.fonts.body?.weight || {},
      letterSpacing: defaultConfig.fonts.body?.letterSpacing || {},
      face: defaultConfig.fonts.body?.face || {},
    },
  },
  media: {
    ...defaultConfig.media,
    xs: { maxWidth: 660 },
    sm: { maxWidth: 800 },
    md: { maxWidth: 1020 },
    lg: { maxWidth: 1280 },
    xl: { maxWidth: 1420 },
    xxl: { maxWidth: 1600 },
    gtXs: { minWidth: 660 + 1 },
    gtSm: { minWidth: 800 + 1 },
    gtMd: { minWidth: 1020 + 1 },
    gtLg: { minWidth: 1280 + 1 },
    short: { maxHeight: 820 },
    tall: { minHeight: 820 },
    hoverNone: { hover: 'none' },
    pointerCoarse: { pointer: 'coarse' },
  },
})

type OurConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends OurConfig {}
}
