import { useEffect, useState } from 'react'

export function useImageElement(src: string | null): { image: HTMLImageElement | null; error: boolean } {
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement } | null>(null)
  const [errorSrc, setErrorSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return

    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) {
        setLoaded({ src, image: img })
        setErrorSrc(null)
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        setLoaded(null)
        setErrorSrc(src)
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
  const error = src !== null && src === errorSrc
  return { image, error }
}
