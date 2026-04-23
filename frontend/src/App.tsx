import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { ImageEditorPage } from './components/ImageEditorPage'
import { NotificationCenter } from './components/NotificationCenter'
import { OwnerEntryPage } from './components/OwnerEntryPage'
import { OwnerOverviewPage } from './components/OwnerOverviewPage'
import { UtilityDrawer } from './components/UtilityDrawer'

function AppShell() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<OwnerEntryPage />} />
        <Route path="/owners/:ownerId" element={<OwnerOverviewPage />} />
        <Route path="/items/:itemId" element={<ImageEditorPage />} />
      </Routes>

      <UtilityDrawer />
      <NotificationCenter />
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
