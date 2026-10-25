import { useEffect } from "react"

export function useOfflineLocale(locale: string) {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return

    let cancelled = false
    const message = { type: "SET_OFFLINE_LOCALE", locale }
    const syncLocale = () => navigator.serviceWorker.controller?.postMessage(message)

    navigator.serviceWorker.addEventListener("controllerchange", syncLocale)
    void navigator.serviceWorker.ready.then((registration) => {
      if (!cancelled) registration.active?.postMessage(message)
    })
    syncLocale()

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener("controllerchange", syncLocale)
    }
  }, [locale])
}
