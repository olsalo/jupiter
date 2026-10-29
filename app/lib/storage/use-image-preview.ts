import { useEffect, useState } from "react"
import type { UploadedImage } from "./image-upload"

export function useImagePreview(key: string | null, url: string | null, ready: UploadedImage | null = null) {
  const [loaded, setLoaded] = useState<UploadedImage | null>(null)
  const [failed, setFailed] = useState<UploadedImage | null>(null)

  useEffect(() => {
    if (!key || !url) {
      setLoaded(null)
      setFailed(null)
      return
    }
    if (ready?.key === key) {
      setLoaded(ready)
      return
    }
    // Refetching can renew a signed URL without changing the image itself.
    if (loaded?.key === key) return

    setFailed(null)
    let active = true
    const image = new Image()
    image.src = url
    void image.decode().then(() => {
      if (active) setLoaded({ key, url })
    }).catch(() => {
      if (active) setFailed({ key, url })
      // Keep the current image if a replacement fails to load. A fresh URL
      // from the next refetch can retry it.
    })

    return () => {
      active = false
    }
  }, [key, url, loaded?.key, ready])

  const displayed = ready?.key === key ? ready : loaded
  return {
    url: key && url ? displayed?.url ?? null : null,
    loading: Boolean(key && url && displayed?.key !== key && !(failed?.key === key && failed.url === url)),
  }
}
