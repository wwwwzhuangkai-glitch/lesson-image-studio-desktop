import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import {
  clearOpenAIKey,
  clearTalKey,
  getAppSettings,
  setOpenAIKey,
  setTalKey,
  updateAppSettings,
} from '../lib/api'
import { useUiStore } from '../store/uiStore'
import type { AppSettings, ExportFormat, ProviderId, ThemeMode, ThemeVariant } from '../types/api'
import { AppTopbar } from './AppTopbar'
import { useInputDialog } from './InputDialog'

const EXPORT_OPTIONS: ExportFormat[] = ['png', 'jpeg', 'webp']
const PROVIDER_OPTIONS: Array<{ id: ProviderId; label: string }> = [
  { id: 'openai_official', label: 'OpenAI 官方' },
  { id: 'tal_gpt_image_2', label: 'TAL gpt-image-2' },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushNotice = useUiStore((state) => state.pushNotice)
  const setThemeMode = useUiStore((state) => state.setThemeMode)
  const setThemeVariant = useUiStore((state) => state.setThemeVariant)
  const inputDialog = useInputDialog()

  const query = useQuery({
    queryKey: ['app-settings'],
    queryFn: getAppSettings,
    staleTime: Infinity,
  })

  const [keyDraft, setKeyDraft] = useState('')
  const [baseUrlDraft, setBaseUrlDraft] = useState('')
  const [modelDraft, setModelDraft] = useState('gpt-image-2')
  const [providerDraft, setProviderDraft] = useState<ProviderId>('openai_official')
  const [talKeyDraft, setTalKeyDraft] = useState('')
  const [exportDraft, setExportDraft] = useState<ExportFormat>('png')
  const [concurrencyDraft, setConcurrencyDraft] = useState(2)

  useEffect(() => {
    if (query.data) {
      // Intentional: when the server payload arrives (once, with
      // staleTime: Infinity) we seed the draft inputs. User edits afterwards
      // are never overwritten since query.data stops changing until a
      // successful mutation replaces it via setQueryData.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBaseUrlDraft(query.data.openai_base_url)
      setModelDraft(query.data.openai_model)
      setProviderDraft(query.data.default_provider)
      setExportDraft(query.data.default_export_format)
      setConcurrencyDraft(query.data.max_concurrent_jobs)
    }
  }, [query.data])

  const updateMutation = useMutation({
    mutationFn: updateAppSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data)
      pushNotice({ title: '已保存' })
    },
    onError: (error: Error) => {
      pushNotice({ title: '保存失败', body: error.message })
    },
  })

  const setKeyMutation = useMutation({
    mutationFn: setOpenAIKey,
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data)
      setKeyDraft('')
      pushNotice({ title: 'API Key 已保存' })
    },
    onError: (error: Error) => pushNotice({ title: '保存失败', body: error.message }),
  })

  const clearKeyMutation = useMutation({
    mutationFn: clearOpenAIKey,
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data)
      pushNotice({ title: 'API Key 已清空' })
    },
    onError: (error: Error) => pushNotice({ title: '清空失败', body: error.message }),
  })

  const setTalKeyMutation = useMutation({
    mutationFn: setTalKey,
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data)
      setTalKeyDraft('')
      pushNotice({ title: '公司认证值已保存' })
    },
    onError: (error: Error) => pushNotice({ title: '保存失败', body: error.message }),
  })

  const clearTalKeyMutation = useMutation({
    mutationFn: clearTalKey,
    onSuccess: (data) => {
      queryClient.setQueryData(['app-settings'], data)
      pushNotice({ title: '公司认证值已清空' })
    },
    onError: (error: Error) => pushNotice({ title: '清空失败', body: error.message }),
  })

  const settings: AppSettings | undefined = query.data

  if (!settings) {
    return (
      <div className="settings-shell">
        <header className="workspace-topbar panel">
          <div>
            <div className="eyebrow">设置</div>
            <h1>正在载入本地设置…</h1>
          </div>
          <div className="topbar-actions">
            <AppTopbar />
          </div>
        </header>
      </div>
    )
  }

  function handleVariantChange(next: ThemeVariant) {
    if (next === settings?.theme_variant) return
    setThemeVariant(next)
    updateMutation.mutate({ theme_variant: next })
  }

  function handleModeChange(next: ThemeMode) {
    if (next === settings?.theme_mode) return
    setThemeMode(next)
    updateMutation.mutate({ theme_mode: next })
  }

  function handleExportChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ExportFormat
    setExportDraft(next)
    updateMutation.mutate({ default_export_format: next })
  }

  function handleProviderChange(next: ProviderId) {
    if (next === settings?.default_provider) return
    setProviderDraft(next)
    updateMutation.mutate({ default_provider: next })
  }

  function handleSaveDefaults(event: FormEvent) {
    event.preventDefault()
    const trimmedModel = modelDraft.trim() || 'gpt-image-2'
    const normalizedUrl = baseUrlDraft.trim()
    const clampedConcurrency = Math.min(10, Math.max(1, Math.round(concurrencyDraft)))
    updateMutation.mutate({
      openai_base_url: normalizedUrl,
      openai_model: trimmedModel,
      max_concurrent_jobs: clampedConcurrency,
    })
  }

  function handleSaveKey(event: FormEvent) {
    event.preventDefault()
    const trimmed = keyDraft.trim()
    if (!trimmed) {
      pushNotice({ title: 'API Key 不能为空' })
      return
    }
    setKeyMutation.mutate(trimmed)
  }

  function handleSaveTalKey(event: FormEvent) {
    event.preventDefault()
    const trimmed = talKeyDraft.trim()
    if (!trimmed) {
      pushNotice({ title: '公司认证值不能为空' })
      return
    }
    setTalKeyMutation.mutate(trimmed)
  }

  async function handleClearKey() {
    if (!settings?.has_openai_api_key) return
    const confirmValue = await inputDialog.prompt({
      title: '清空 API Key',
      message: '清空后会回退到环境变量中的 key，如果也没有，AI 任务将全部失败。输入 清空 以确认。',
      placeholder: '输入「清空」二字确认',
      confirmLabel: '确认清空',
    })
    if (confirmValue !== '清空') {
      pushNotice({ title: '已取消' })
      return
    }
    clearKeyMutation.mutate()
  }

  async function handleClearTalKey() {
    if (!settings?.has_tal_service_api_key) return
    const confirmValue = await inputDialog.prompt({
      title: '清空公司认证值',
      message: '清空后 TAL provider 将无法执行新任务。输入 清空 以确认。',
      placeholder: '输入「清空」二字确认',
      confirmLabel: '确认清空',
    })
    if (confirmValue !== '清空') {
      pushNotice({ title: '已取消' })
      return
    }
    clearTalKeyMutation.mutate()
  }

  return (
    <div className="settings-shell">
      <header className="workspace-topbar panel">
        <div>
          <div className="eyebrow">设置</div>
          <h1>本地工作台设置</h1>
          <p className="muted">所有设置仅保存在当前机器的本地数据库，不会上传到任何云端。</p>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button small" onClick={() => navigate(-1)}>
            返回上一页
          </button>
          <AppTopbar />
        </div>
      </header>

      <div className="workspace-scroll">
        <div className="settings-grid">
          <section className="panel settings-section">
            <div>
              <div className="eyebrow">Provider</div>
              <h2>默认 Provider</h2>
            </div>
            <div className="settings-row">
              <span className="field-label">新任务默认使用</span>
              <div className="segmented">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={providerDraft === option.id ? 'active' : ''}
                    disabled={updateMutation.isPending}
                    onClick={() => handleProviderChange(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="settings-help">已创建任务会使用入队时快照的 provider。</span>
            </div>
          </section>

          <section className="panel settings-section">
            <div>
              <div className="eyebrow">密钥</div>
              <h2>OpenAI API Key</h2>
            </div>
            <div className="settings-inline">
              <span className={`key-status-badge${settings.has_openai_api_key ? ' configured' : ''}`}>
                {settings.openai_api_key_source === 'app_settings'
                  ? '已配置 · 本地'
                  : settings.openai_api_key_source === 'env'
                    ? '已配置 · 来自环境变量'
                    : '未配置'}
              </span>
              {settings.openai_api_key_source === 'app_settings' ? (
                <button
                  type="button"
                  className="ghost-button small danger"
                  disabled={clearKeyMutation.isPending}
                  onClick={() => void handleClearKey()}
                >
                  清空密钥
                </button>
              ) : null}
              {settings.openai_api_key_source === 'env' ? (
                <span className="settings-help">
                  环境变量 key 不能从 UI 清空，请修改 <code>.env</code> 或在上方填新 key 覆盖。
                </span>
              ) : null}
            </div>
            <form className="settings-row" onSubmit={handleSaveKey}>
              <label>
                <span className="field-label">新的 Key</span>
                <input
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                  type="password"
                />
              </label>
              <div className="settings-inline">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={setKeyMutation.isPending || !keyDraft.trim()}
                >
                  {settings.has_openai_api_key ? '更新 Key' : '保存 Key'}
                </button>
                <span className="settings-help">保存后不会再从接口回传任何字符。</span>
              </div>
            </form>
          </section>

          <section className="panel settings-section">
            <div>
              <div className="eyebrow">公司 AI 服务</div>
              <h2>TAL gpt-image-2 配置</h2>
              <p className="settings-help">
                公司兼容层地址由应用固定使用，老师只需要配置 appId:apiKey。
              </p>
            </div>
            <div className="settings-inline">
              <span className={`key-status-badge${settings.has_tal_service_api_key ? ' configured' : ''}`}>
                {settings.has_tal_service_api_key ? '已配置 · 本地' : '未配置'}
              </span>
              {settings.has_tal_service_api_key ? (
                <button
                  type="button"
                  className="ghost-button small danger"
                  disabled={clearTalKeyMutation.isPending}
                  onClick={() => void handleClearTalKey()}
                >
                  清空认证值
                </button>
              ) : null}
            </div>
            <form className="settings-row" onSubmit={handleSaveTalKey}>
              <label>
                <span className="field-label">认证值</span>
                <input
                  value={talKeyDraft}
                  onChange={(event) => setTalKeyDraft(event.target.value)}
                  placeholder="appId:apiKey"
                  autoComplete="off"
                  spellCheck={false}
                  type="password"
                />
              </label>
              <div className="settings-inline">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={setTalKeyMutation.isPending || !talKeyDraft.trim()}
                >
                  {settings.has_tal_service_api_key ? '更新公司认证值' : '保存公司认证值'}
                </button>
                <span className="settings-help">保存后不会再从接口回传任何字符。</span>
              </div>
            </form>
          </section>

          <section className="panel settings-section">
            <div>
              <div className="eyebrow">外观</div>
              <h2>主题风格与明暗</h2>
            </div>
            <div className="settings-row">
              <span className="field-label">风格</span>
              <div className="segmented">
                <button
                  type="button"
                  className={settings.theme_variant === 'graphite' ? 'active' : ''}
                  onClick={() => handleVariantChange('graphite')}
                >
                  石板冷静
                </button>
                <button
                  type="button"
                  className={settings.theme_variant === 'glass' ? 'active' : ''}
                  onClick={() => handleVariantChange('glass')}
                >
                  浅雾玻璃
                </button>
              </div>
              <span className="settings-help">
                石板冷静为默认风格，内部专业工具气质；浅雾玻璃延续第一版的柔光玻璃观感。
              </span>
            </div>
            <div className="settings-row">
              <span className="field-label">明暗</span>
              <div className="segmented">
                <button
                  type="button"
                  className={settings.theme_mode === 'light' ? 'active' : ''}
                  onClick={() => handleModeChange('light')}
                >
                  Light
                </button>
                <button
                  type="button"
                  className={settings.theme_mode === 'dark' ? 'active' : ''}
                  onClick={() => handleModeChange('dark')}
                >
                  Dark
                </button>
              </div>
              <span className="settings-help">顶栏的日/月图标与此等效。</span>
            </div>
          </section>

          <section className="panel settings-section">
            <div>
              <div className="eyebrow">默认参数</div>
              <h2>OpenAI 连接与导出</h2>
            </div>
            <form className="settings-row" onSubmit={handleSaveDefaults}>
              <label>
                <span className="field-label">OpenAI base URL</span>
                <input
                  value={baseUrlDraft}
                  onChange={(event) => setBaseUrlDraft(event.target.value)}
                  placeholder="留空走官方；自建代理或兼容端点填完整 URL"
                  spellCheck={false}
                />
              </label>
              <label>
                <span className="field-label">生图模型</span>
                <input
                  value={modelDraft}
                  onChange={(event) => setModelDraft(event.target.value)}
                  placeholder="gpt-image-2"
                  spellCheck={false}
                />
                <span className="settings-help">
                  默认为 gpt-image-2。改动会立即应用到后续所有 AI 任务。
                </span>
              </label>
              <label>
                <span className="field-label">默认导出格式</span>
                <select value={exportDraft} onChange={handleExportChange}>
                  {EXPORT_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="settings-help">
                  用于「导出定稿 / 导出选中」的默认格式，质量和尺寸仍在编辑页单独选。
                </span>
              </label>
              <label>
                <span className="field-label">并发任务上限</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={concurrencyDraft}
                  onChange={(event) => setConcurrencyDraft(Number(event.target.value) || 1)}
                />
                <span className="settings-help">
                  同时排队+执行中的 AI 任务上限，达到上限后发起任务会被拒绝，避免误操作刷费。
                </span>
              </label>
              <div className="settings-inline">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={updateMutation.isPending}
                >
                  保存默认参数
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
