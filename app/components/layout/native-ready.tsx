import { useEffect } from "react"

export function NativeReady() {
  useEffect(() => {
    const bridge = (
      window as Window & {
        ReactNativeWebView?: { postMessage(message: string): void }
      }
    ).ReactNativeWebView

    if (!bridge) return

    let secondFrame: number | undefined
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        bridge.postMessage("app:hydrated")
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame)
    }
  }, [])

  return null
}
