import { useEffect, useState } from 'react'

export function useImageElement(src: string | null) {
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement } | null>(null)

  useEffect(() => {
    if (!src) {
      return
    }

    let cancelled = false
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled) {
        setLoaded({ src, image: img })
      }
    }
    img.src = src

    return () => {
      cancelled = true
      img.onload = null
    }
  }, [src])

  return loaded?.src === src ? loaded.image : null
}
