import { useEffect, useState } from 'react'

export function useImageElement(src: string | null): { image: HTMLImageElement | null; error: boolean } {
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement } | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(false)
      return
    }

    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) {
        setLoaded({ src, image: img })
        setError(false)
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        setLoaded(null)
        setError(true)
      }
    }
    img.src = src

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src])

  const image = loaded?.src === src ? loaded.image : null
  return { image, error }
}
