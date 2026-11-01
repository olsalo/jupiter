import { bookingPageAccentForeground } from "./booking-page-colors"

export function bookingFavicon(name: string, accentColor?: string | null) {
  const background = accentColor && /^#[\da-f]{6}$/i.test(accentColor) ? accentColor : "#262626"
  const foreground = bookingPageAccentForeground(background)
  const initial = name.trim().split(/\s+/).map((part) => part.match(/[\p{L}\p{N}]/u)?.[0]).find(Boolean)?.toUpperCase() ?? ""
  const content = initial
    ? `<text x="32" y="33" dy=".35em" text-anchor="middle" fill="${foreground}" font-family="Arial, sans-serif" font-size="34" font-weight="600">${initial}</text>`
    : `<g fill="none" stroke="${foreground}" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="24" r="8"/><path d="M18 49v-4a14 14 0 0 1 28 0v4"/></g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${background}"/>${content}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
