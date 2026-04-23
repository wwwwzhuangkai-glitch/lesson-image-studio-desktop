import { useEffect } from 'react'
import { useUiStore, type ThemeMode, type ThemeVariant } from '../store/uiStore'

export function useTheme() {
  const themeMode = useUiStore((state) => state.themeMode)
  const themeVariant = useUiStore((state) => state.themeVariant)
  const themeHydrated = useUiStore((state) => state.themeHydrated)
  const setThemeMode = useUiStore((state) => state.setThemeMode)
  const setThemeVariant = useUiStore((state) => state.setThemeVariant)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = `${themeVariant}-${themeMode}`
  }, [themeMode, themeVariant])

  const toggleMode = () => {
    const next: ThemeMode = themeMode === 'light' ? 'dark' : 'light'
    setThemeMode(next)
  }

  return {
    themeMode,
    themeVariant,
    themeHydrated,
    setThemeMode,
    setThemeVariant,
    toggleMode,
  }
}

export type { ThemeMode, ThemeVariant }
