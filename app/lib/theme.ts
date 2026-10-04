export const themes = ["light", "dark"] as const

export type Theme = (typeof themes)[number]

export const defaultTheme: Theme = "light"

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme)
}

export function syncThemeColor() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (meta) {
    const style = getComputedStyle(document.documentElement)
    meta.content = style.getPropertyValue("--page-theme-color").trim() || getComputedStyle(document.body).backgroundColor
  }
}
