import { flushSync } from "react-dom"

export const themes = ["light", "dark"] as const

export type Theme = (typeof themes)[number]

export const defaultTheme: Theme = "light"

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme)
}

let activeThemeTransition: ViewTransition | undefined

export function changeThemeWithTransition(update: () => void) {
  activeThemeTransition?.skipTransition()
  const root = document.documentElement
  root.setAttribute("data-theme-transition", "")
  // Capture the final colors, without each component starting its own transition
  getComputedStyle(document.body).backgroundColor

  if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    flushSync(update)
    getComputedStyle(document.body).backgroundColor
    root.removeAttribute("data-theme-transition")
    return
  }

  const transition = document.startViewTransition(() => flushSync(update))
  activeThemeTransition = transition
  void transition.finished.catch(() => undefined).finally(() => {
    if (activeThemeTransition !== transition) return
    activeThemeTransition = undefined
    root.removeAttribute("data-theme-transition")
  })
}

export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (meta) {
    const style = getComputedStyle(document.documentElement)
    meta.content = style.getPropertyValue("--page-theme-color").trim() || getComputedStyle(document.body).backgroundColor
  }
}
