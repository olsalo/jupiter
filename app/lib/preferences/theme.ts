import { flushSync } from "react-dom"

export const themes = ["light", "dark"] as const

export type Theme = (typeof themes)[number]

export const defaultTheme: Theme = "light"

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme)
}

export function changeThemeWithTransition(update: () => void) {
  const root = document.documentElement
  root.setAttribute("data-theme-transition", "")
  getComputedStyle(document.body).backgroundColor
  flushSync(update)
  getComputedStyle(document.body).backgroundColor
  root.removeAttribute("data-theme-transition")
}

export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (meta) {
    const style = getComputedStyle(document.documentElement)
    meta.content = style.getPropertyValue("--page-theme-color").trim() || getComputedStyle(document.body).backgroundColor
  }
}
