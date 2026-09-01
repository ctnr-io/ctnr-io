import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
  isLight: boolean
}

// matchMedia is undefined during the Expo Router static prerender (Node). Guard it so the
// default context value is SSR-safe; a consumer outside the provider then reads false, not a throw.
const prefersDark = () =>
  typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia('(prefers-color-scheme: dark)').matches

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  get isDark() {
    return prefersDark()
  },
  get isLight() {
    return !prefersDark()
  },
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
  ...props
}: ThemeProviderProps) {
  // Seed deterministically: localStorage/matchMedia don't exist in the SSR prerender, so reading them
  // during render throws inside the root Suspense boundary (React #419). Hydrate them in effects instead.
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored) setTheme(stored)

    const media = globalThis.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(media.matches)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [storageKey])

  useEffect(() => {
    const root = globalThis.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      root.classList.add(systemDark ? 'dark' : 'light')
      return
    }

    root.classList.add(theme)
  }, [theme, systemDark])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
    isDark: theme === 'dark' || (theme === 'system' && systemDark),
    isLight: theme === 'light' || (theme === 'system' && !systemDark),
  }
  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
