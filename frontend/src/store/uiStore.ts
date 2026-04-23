import { create } from 'zustand'

export interface Notice {
  id: string
  title: string
  body?: string
}

export type ThemeMode = 'light' | 'dark'
export type ThemeVariant = 'graphite' | 'glass'

type TaskScope = 'owner' | 'all'
type UtilityTab = 'tasks' | 'events' | 'recycle'

interface UiState {
  utilityDrawerOpen: boolean
  utilityTab: UtilityTab
  taskScope: TaskScope
  currentOwnerId: string | null
  notices: Notice[]
  jobIndicatorCount: number
  themeMode: ThemeMode
  themeVariant: ThemeVariant
  themeHydrated: boolean
  openUtilityDrawer: (tab?: UtilityTab) => void
  closeUtilityDrawer: () => void
  setUtilityTab: (tab: UtilityTab) => void
  setTaskScope: (scope: TaskScope) => void
  setCurrentOwnerId: (ownerId: string | null) => void
  pushNotice: (notice: Omit<Notice, 'id'>) => void
  dismissNotice: (id: string) => void
  setJobIndicatorCount: (count: number) => void
  setThemeMode: (mode: ThemeMode) => void
  setThemeVariant: (variant: ThemeVariant) => void
  hydrateTheme: (mode: ThemeMode, variant: ThemeVariant) => void
}

function readInitialTheme(): { mode: ThemeMode; variant: ThemeVariant } {
  if (typeof window === 'undefined') {
    return { mode: 'light', variant: 'graphite' }
  }
  try {
    const stored = window.localStorage.getItem('lis-theme') ?? ''
    const [variant, mode] = stored.split('-') as [ThemeVariant, ThemeMode]
    if ((variant === 'graphite' || variant === 'glass') && (mode === 'light' || mode === 'dark')) {
      return { mode, variant }
    }
  } catch {
    /* ignore */
  }
  return { mode: 'light', variant: 'graphite' }
}

function persistTheme(mode: ThemeMode, variant: ThemeVariant) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem('lis-theme', `${variant}-${mode}`)
    document.documentElement.dataset.theme = `${variant}-${mode}`
  } catch {
    /* ignore */
  }
}

const initialTheme = readInitialTheme()

export const useUiStore = create<UiState>((set) => ({
  utilityDrawerOpen: false,
  utilityTab: 'tasks',
  taskScope: 'owner',
  currentOwnerId: null,
  notices: [],
  jobIndicatorCount: 0,
  themeMode: initialTheme.mode,
  themeVariant: initialTheme.variant,
  themeHydrated: false,
  openUtilityDrawer: (tab) => set((state) => ({ utilityDrawerOpen: true, utilityTab: tab ?? state.utilityTab })),
  closeUtilityDrawer: () => set({ utilityDrawerOpen: false }),
  setUtilityTab: (tab) => set({ utilityTab: tab }),
  setTaskScope: (scope) => set({ taskScope: scope }),
  setCurrentOwnerId: (ownerId) => set({ currentOwnerId: ownerId }),
  pushNotice: (notice) =>
    set((state) => ({
      notices: [...state.notices, { ...notice, id: `${Date.now()}-${Math.random()}` }],
    })),
  dismissNotice: (id) =>
    set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
  setJobIndicatorCount: (count) => set({ jobIndicatorCount: count }),
  setThemeMode: (mode) =>
    set((state) => {
      persistTheme(mode, state.themeVariant)
      return { themeMode: mode }
    }),
  setThemeVariant: (variant) =>
    set((state) => {
      persistTheme(state.themeMode, variant)
      return { themeVariant: variant }
    }),
  hydrateTheme: (mode, variant) => {
    persistTheme(mode, variant)
    set({ themeMode: mode, themeVariant: variant, themeHydrated: true })
  },
}))
