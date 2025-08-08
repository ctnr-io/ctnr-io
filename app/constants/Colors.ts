/**
 * ctnr.io brand colors and theme configuration
 */

export const CtnrColors = {
  primary: '#f8b500',    // Orange
  secondary: '#393e46',  // Dark Gray
  white: '#ffffff',      // White
  background: '#f5f5f5', // Light background
  text: '#393e46',       // Text color
  textLight: '#666666',  // Light text
  border: '#e0e0e0',     // Border color
  success: '#4caf50',    // Success green
  error: '#f44336',      // Error red
  warning: '#ff9800',    // Warning orange
} as const

const tintColorLight = CtnrColors.primary
const tintColorDark = CtnrColors.white

export const Colors = {
  light: {
    text: CtnrColors.text,
    background: CtnrColors.white,
    tint: tintColorLight,
    icon: CtnrColors.textLight,
    tabIconDefault: CtnrColors.textLight,
    tabIconSelected: tintColorLight,
    primary: CtnrColors.primary,
    secondary: CtnrColors.secondary,
    border: CtnrColors.border,
    success: CtnrColors.success,
    error: CtnrColors.error,
    warning: CtnrColors.warning,
  },
  dark: {
    text: CtnrColors.white,
    background: CtnrColors.secondary,
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: CtnrColors.primary,
    secondary: CtnrColors.secondary,
    border: '#555555',
    success: CtnrColors.success,
    error: CtnrColors.error,
    warning: CtnrColors.warning,
  },
}
