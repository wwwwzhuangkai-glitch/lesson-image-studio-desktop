import { useEffect } from 'react'

import { useUiStore } from '../store/uiStore'

export function NotificationCenter() {
  const notices = useUiStore((state) => state.notices)
  const dismissNotice = useUiStore((state) => state.dismissNotice)

  useEffect(() => {
    if (!notices.length) {
      return
    }
    const timers = notices.map((notice) =>
      window.setTimeout(() => dismissNotice(notice.id), 3500),
    )
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [dismissNotice, notices])

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
