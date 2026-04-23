import { create } from 'zustand'

export interface Notice {
  id: string
  title: string
  body?: string
}

type TaskScope = 'owner' | 'all'
type UtilityTab = 'tasks' | 'events' | 'recycle'

interface UiState {
  utilityDrawerOpen: boolean
  utilityTab: UtilityTab
  taskScope: TaskScope
  currentOwnerId: string | null
  notices: Notice[]
  jobIndicatorCount: number
  openUtilityDrawer: (tab?: UtilityTab) => void
  closeUtilityDrawer: () => void
  setUtilityTab: (tab: UtilityTab) => void
  setTaskScope: (scope: TaskScope) => void
  setCurrentOwnerId: (ownerId: string | null) => void
  pushNotice: (notice: Omit<Notice, 'id'>) => void
  dismissNotice: (id: string) => void
  setJobIndicatorCount: (count: number) => void
}

export const useUiStore = create<UiState>((set) => ({
  utilityDrawerOpen: false,
  utilityTab: 'tasks',
  taskScope: 'owner',
  currentOwnerId: null,
  notices: [],
  jobIndicatorCount: 0,
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
}))
