import { useEffect, useState } from 'react'

export interface InputDialogOptions {
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  multiline?: boolean
}

type Resolver = (value: string | null) => void

interface PendingDialog {
  options: InputDialogOptions
  resolve: Resolver
}

let setPendingRef: ((next: PendingDialog | null) => void) | null = null

// eslint-disable-next-line react-refresh/only-export-components
export function openInputDialog(options: InputDialogOptions): Promise<string | null> {
  if (!setPendingRef) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    setPendingRef?.({ options, resolve })
  })
}

// eslint-disable-next-line react-refresh/only-export-components
export function useInputDialog() {
  return { prompt: openInputDialog }
}

export function InputDialogRoot() {
  const [pending, setPending] = useState<PendingDialog | null>(null)
  const [value, setValue] = useState('')

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
      // Intentional: the dialog is command-driven, so we must reset the input
      // draft when a new request comes in. Safe because pending only changes
      // on open/close, not every render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(pending.options.defaultValue ?? '')
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
  })

  if (!pending) return null

  function close(result: string | null) {
    const current = pending
    setPending(null)
    current?.resolve(result)
  }

  function confirm() {
    const trimmed = value.trim()
    close(trimmed.length > 0 ? trimmed : null)
  }

  const { options } = pending

  return (
    <div className="dialog-backdrop" onClick={() => close(null)}>
      <div className="dialog-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h2>{options.title}</h2>
        {options.message ? <p>{options.message}</p> : null}
        <div className="dialog-field">
          {options.multiline ? (
            <textarea
              autoFocus
              value={value}
              placeholder={options.placeholder}
              onChange={(event) => setValue(event.target.value)}
            />
          ) : (
            <input
              autoFocus
              value={value}
              placeholder={options.placeholder}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  confirm()
                }
              }}
            />
          )}
        </div>
        <div className="dialog-actions">
          <button className="ghost-button" onClick={() => close(null)}>
            {options.cancelLabel ?? '取消'}
          </button>
          <button className="primary-button" onClick={confirm}>
            {options.confirmLabel ?? '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
