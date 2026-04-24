import { useEffect, useState } from 'react'

export interface PresetFormInitial {
  name?: string
  summary?: string
  prompt_text?: string
}

export interface PresetFormResult {
  name: string
  summary: string
  prompt_text?: string
}

export interface PresetFormOptions {
  title: string
  description?: string
  initial?: PresetFormInitial
  mode: 'create' | 'edit'
  confirmLabel?: string
}

type Resolver = (value: PresetFormResult | null) => void

interface PendingDialog {
  options: PresetFormOptions
  resolve: Resolver
}

let setPendingRef: ((next: PendingDialog | null) => void) | null = null

// eslint-disable-next-line react-refresh/only-export-components
export function openPresetFormDialog(options: PresetFormOptions): Promise<PresetFormResult | null> {
  if (!setPendingRef) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    setPendingRef?.({ options, resolve })
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePresetFormDialog() {
  return { edit: openPresetFormDialog }
}

export function PresetFormDialogRoot() {
  const [pending, setPending] = useState<PendingDialog | null>(null)
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [promptText, setPromptText] = useState('')

  useEffect(() => {
    setPendingRef = setPending
    return () => {
      if (setPendingRef === setPending) {
        setPendingRef = null
      }
    }
  }, [])

  useEffect(() => {
    if (pending) {
      // Intentional: the dialog is command-driven, so we must reset the
      // three draft fields when a new request comes in. Safe because
      // pending only changes on open/close, not every render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(pending.options.initial?.name ?? '')
      setSummary(pending.options.initial?.summary ?? '')
      setPromptText(pending.options.initial?.prompt_text ?? '')
    }
  }, [pending])

  useEffect(() => {
    if (!pending) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  if (!pending) return null

  function close(result: PresetFormResult | null) {
    const current = pending
    setPending(null)
    current?.resolve(result)
  }

  function confirm() {
    if (!pending) return
    const cleanName = name.trim()
    const cleanSummary = summary.trim()
    if (!cleanName || !cleanSummary) {
      return
    }
    const result: PresetFormResult = {
      name: cleanName,
      summary: cleanSummary,
    }
    if (pending.options.mode === 'edit') {
      const cleanPrompt = promptText.trim()
      if (!cleanPrompt) {
        return
      }
      result.prompt_text = cleanPrompt
    }
    close(result)
  }

  const { options } = pending
  const canConfirm =
    name.trim().length > 0 &&
    summary.trim().length > 0 &&
    (options.mode !== 'edit' || promptText.trim().length > 0)

  return (
    <div className="dialog-backdrop" onClick={() => close(null)}>
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{options.title}</h2>
        {options.description ? <p>{options.description}</p> : null}

        <div className="dialog-field">
          <label>
            <span className="field-label">模板名称</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：高中物理插图"
            />
          </label>
        </div>

        <div className="dialog-field">
          <label>
            <span className="field-label">模板摘要</span>
            <input
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="一句话说明模板的定位或风格"
            />
          </label>
        </div>

        {options.mode === 'edit' ? (
          <div className="dialog-field">
            <label>
              <span className="field-label">完整提示词</span>
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder="完整的 AI 生图/改图提示词"
              />
            </label>
          </div>
        ) : null}

        <div className="dialog-actions">
          <button className="ghost-button" onClick={() => close(null)}>
            取消
          </button>
          <button className="primary-button" disabled={!canConfirm} onClick={confirm}>
            {options.confirmLabel ?? '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
