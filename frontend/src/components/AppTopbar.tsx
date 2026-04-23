import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { useTheme } from '../hooks/useTheme'
import { updateAppSettings } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import type { AppSettings } from '../types/api'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M3 12h2M19 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79Z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.13 16.9l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01A1.7 1.7 0 0 0 20.91 10H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
    </svg>
  )
}

export function AppTopbar() {
  const { themeMode, toggleMode } = useTheme()
  const pushNotice = useUiStore((state) => state.pushNotice)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (next: 'light' | 'dark') => updateAppSettings({ theme_mode: next }),
    onSuccess: (data: AppSettings) => {
      queryClient.setQueryData(['app-settings'], data)
    },
    onError: (error: Error) => {
      pushNotice({ title: '保存主题失败', body: error.message })
    },
  })

  function handleToggle() {
    const next: 'light' | 'dark' = themeMode === 'light' ? 'dark' : 'light'
    toggleMode()
    mutation.mutate(next)
  }

  return (
    <div className="app-topbar-tools">
      <button
        type="button"
        className="topbar-icon-button"
        aria-label={themeMode === 'light' ? '切换到深色主题' : '切换到浅色主题'}
        onClick={handleToggle}
      >
        {themeMode === 'light' ? <MoonIcon /> : <SunIcon />}
      </button>
      <Link to="/settings" className="topbar-icon-button" aria-label="打开设置">
        <GearIcon />
      </Link>
    </div>
  )
}
