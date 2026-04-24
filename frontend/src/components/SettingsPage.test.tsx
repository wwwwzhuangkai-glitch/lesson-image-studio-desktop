import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'

import type { AppSettings } from '../types/api'
import { SettingsPage } from './SettingsPage'

const apiMocks = vi.hoisted(() => ({
  clearOpenAIKey: vi.fn(),
  clearTalKey: vi.fn(),
  getAppSettings: vi.fn(),
  setOpenAIKey: vi.fn(),
  setTalKey: vi.fn(),
  updateAppSettings: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  clearOpenAIKey: apiMocks.clearOpenAIKey,
  clearTalKey: apiMocks.clearTalKey,
  getAppSettings: apiMocks.getAppSettings,
  setOpenAIKey: apiMocks.setOpenAIKey,
  setTalKey: apiMocks.setTalKey,
  updateAppSettings: apiMocks.updateAppSettings,
}))

function createSettings(): AppSettings {
  return {
    has_openai_api_key: false,
    openai_api_key_source: 'none',
    has_tal_service_api_key: false,
    openai_base_url: '',
    openai_model: 'gpt-image-2',
    default_provider: 'openai_official',
    default_export_format: 'png',
    theme_mode: 'light',
    theme_variant: 'graphite',
    max_concurrent_jobs: 2,
    updated_at: '2026-04-24T00:00:00Z',
  }
}

let currentSettings: AppSettings

beforeEach(() => {
  currentSettings = createSettings()
  Object.values(apiMocks).forEach((mock) => mock.mockReset())
  apiMocks.getAppSettings.mockImplementation(async () => currentSettings)
  apiMocks.updateAppSettings.mockImplementation(async (patch: Partial<AppSettings>) => {
    currentSettings = { ...currentSettings, ...patch }
    return currentSettings
  })
  apiMocks.setOpenAIKey.mockImplementation(async () => ({
    ...currentSettings,
    has_openai_api_key: true,
    openai_api_key_source: 'app_settings',
  }))
  apiMocks.clearOpenAIKey.mockImplementation(async () => ({
    ...currentSettings,
    has_openai_api_key: false,
    openai_api_key_source: 'none',
  }))
  apiMocks.setTalKey.mockImplementation(async () => {
    currentSettings = { ...currentSettings, has_tal_service_api_key: true }
    return currentSettings
  })
  apiMocks.clearTalKey.mockImplementation(async () => {
    currentSettings = { ...currentSettings, has_tal_service_api_key: false }
    return currentSettings
  })
})

function renderSettingsPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

it('saves provider without rendering TAL base URL settings', async () => {
  renderSettingsPage()

  expect(await screen.findByText('默认 Provider')).toBeInTheDocument()
  expect(screen.getByText('OpenAI Key 与连接')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'TAL gpt-image-2' }))

  await waitFor(() => {
    expect(apiMocks.updateAppSettings.mock.calls.map(([patch]) => patch)).toContainEqual({
      default_provider: 'tal_gpt_image_2',
    })
  })

  expect(screen.queryByText('OpenAI Key 与连接')).not.toBeInTheDocument()
  expect(screen.queryByText('OpenAI base URL')).not.toBeInTheDocument()
  expect(screen.getByText('导出与任务上限')).toBeInTheDocument()
  expect(screen.queryByText('公司服务根地址')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '保存公司服务地址' })).not.toBeInTheDocument()
})

it('saves TAL key without rendering the secret after success', async () => {
  renderSettingsPage()

  expect(await screen.findByText('默认 Provider')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'TAL gpt-image-2' }))
  await screen.findByText('TAL gpt-image-2 配置')
  const keyInput = screen.getByLabelText('认证值')
  fireEvent.change(keyInput, { target: { value: 'app-id:api-secret' } })
  fireEvent.click(screen.getByRole('button', { name: '保存公司认证值' }))

  await waitFor(() => {
    expect(apiMocks.setTalKey.mock.calls[0]?.[0]).toBe('app-id:api-secret')
    expect(keyInput).toHaveValue('')
  })
  expect(screen.queryByText('app-id:api-secret')).not.toBeInTheDocument()
})

it('keeps export format and concurrency as general defaults for TAL provider', async () => {
  currentSettings = {
    ...currentSettings,
    default_provider: 'tal_gpt_image_2',
    default_export_format: 'png',
    max_concurrent_jobs: 2,
  }
  renderSettingsPage()

  expect(await screen.findByText('TAL gpt-image-2 配置')).toBeInTheDocument()
  expect(screen.queryByText('OpenAI Key 与连接')).not.toBeInTheDocument()
  expect(screen.queryByText('OpenAI base URL')).not.toBeInTheDocument()
  expect(screen.getByText('导出与任务上限')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('默认导出格式'), { target: { value: 'webp' } })
  fireEvent.change(screen.getByLabelText('并发任务上限'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: '保存通用默认参数' }))

  await waitFor(() => {
    expect(apiMocks.updateAppSettings.mock.calls.map(([patch]) => patch)).toContainEqual({
      default_export_format: 'webp',
      max_concurrent_jobs: 4,
    })
  })
})
