import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ImageEditorPage } from './components/ImageEditorPage'
import { InputDialogRoot } from './components/InputDialog'
import { NotificationCenter } from './components/NotificationCenter'
import { OwnerEntryPage } from './components/OwnerEntryPage'
import { OwnerOverviewPage } from './components/OwnerOverviewPage'
import { PresetFormDialogRoot } from './components/PresetFormDialog'
import { SettingsPage } from './components/SettingsPage'
import { UtilityDrawer } from './components/UtilityDrawer'
import { useTheme } from './hooks/useTheme'
import { getAppSettings } from './lib/api'
import { useUiStore } from './store/uiStore'

function ThemeBridge() {
  useTheme()
  const hydrateTheme = useUiStore((state) => state.hydrateTheme)

  useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const data = await getAppSettings()
      hydrateTheme(data.theme_mode, data.theme_variant)
      return data
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  return null
}

function AppShell() {
  return (
    <div className="app-shell">
      <ThemeBridge />
      <Routes>
        <Route path="/" element={<OwnerEntryPage />} />
        <Route path="/owners/:ownerId" element={<OwnerOverviewPage />} />
        <Route path="/items/:itemId" element={<ImageEditorPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      <UtilityDrawer />
      <NotificationCenter />
      <InputDialogRoot />
      <PresetFormDialogRoot />
    </div>
  )
}

export default function App() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
