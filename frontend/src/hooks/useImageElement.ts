import { useEffect, useState } from 'react'

export function useImageElement(src: string | null) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setImage(img)
    img.src = src

    return () => {
      setImage(null)
    }
  }, [src])

  return image
}
