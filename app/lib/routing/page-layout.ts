export type PageLayoutPreference = "viewport" | "scroll" | "viewport-desktop"

export function resolvePageLayout(preference: PageLayoutPreference, isMobile: boolean): "viewport" | "scroll" {
  return preference === "viewport" || (preference === "viewport-desktop" && !isMobile) ? "viewport" : "scroll"
}
