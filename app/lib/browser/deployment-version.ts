const checkInterval = 30_000
const idleInterval = 60_000
const reloadKey = "deployment-reload-at"

// A rolling deployment or a stale proxy must not cause a reload loop
export function claimDeploymentReload(storage: Pick<Storage, "getItem" | "setItem">, now = Date.now()) {
  try {
    const previous = Number(storage.getItem(reloadKey))
    if (previous > 0 && now - previous < 60_000) return false
    storage.setItem(reloadKey, String(now))
    return true
  } catch {
    return false
  }
}

export function watchDeploymentVersion(version: string, onUpdate: (version: string, idle: boolean) => void) {
  let lastCheck = -Infinity
  let lastActivity = -Infinity
  let pending: AbortController | null = null
  let disposed = false

  const check = async (force = false) => {
    if (disposed || document.visibilityState !== "visible" || !navigator.onLine || pending) return
    if (!force && Date.now() - lastCheck < checkInterval) return
    lastCheck = Date.now()
    const controller = new AbortController()
    pending = controller
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await fetch("/api/version", {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      })
      if (!response.ok || response.redirected) return
      const result: unknown = await response.json()
      if (disposed || controller.signal.aborted || document.visibilityState !== "visible") return
      if (typeof result !== "object" || result === null || !("version" in result)) return
      const next = result.version
      if (typeof next === "string" && next.length > 0 && next.length <= 200 && next !== version) {
        onUpdate(next, Date.now() - lastActivity >= idleInterval)
      }
    } catch {
      // Keep the current page usable offline or when the deployment is unavailable
    } finally {
      clearTimeout(timeout)
      if (pending === controller) pending = null
    }
  }
  const resume = () => { void check() }
  const reconnect = () => { void check(true) }
  const show = (event: PageTransitionEvent) => { void check(event.persisted) }
  const activity = () => { lastActivity = Date.now() }
  const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart"] as const
  for (const name of activityEvents) window.addEventListener(name, activity, { capture: true, passive: true })
  document.addEventListener("visibilitychange", resume)
  window.addEventListener("pageshow", show)
  window.addEventListener("online", reconnect)
  const interval = setInterval(resume, idleInterval)
  void check()

  return () => {
    disposed = true
    pending?.abort()
    clearInterval(interval)
    for (const name of activityEvents) window.removeEventListener(name, activity, true)
    document.removeEventListener("visibilitychange", resume)
    window.removeEventListener("pageshow", show)
    window.removeEventListener("online", reconnect)
  }
}
