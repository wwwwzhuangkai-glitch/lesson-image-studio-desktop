import { useEffect, useRef } from 'react'

import { useUiStore } from '../store/uiStore'

export function NotificationCenter() {
  const notices = useUiStore((state) => state.notices)
  const dismissNotice = useUiStore((state) => state.dismissNotice)
  const timerMap = useRef(new Map<string, number>())

  useEffect(() => {
    for (const notice of notices) {
      if (timerMap.current.has(notice.id)) continue
      const timerId = window.setTimeout(() => {
        timerMap.current.delete(notice.id)
        dismissNotice(notice.id)
      }, 3500)
      timerMap.current.set(notice.id, timerId)
    }

    const activeIds = new Set(notices.map((n) => n.id))
    for (const [id, timerId] of timerMap.current) {
      if (!activeIds.has(id)) {
        window.clearTimeout(timerId)
        timerMap.current.delete(id)
      }
    }
  }, [dismissNotice, notices])

  useEffect(() => {
    const map = timerMap.current
    return () => {
      for (const timerId of map.values()) {
        window.clearTimeout(timerId)
      }
      map.clear()
    }
  }, [])

  return (
    <div className="notice-stack" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className="notice-card">
          <strong>{notice.title}</strong>
          {notice.body ? <p>{notice.body}</p> : null}
        </div>
      ))}
    </div>
  )
}
