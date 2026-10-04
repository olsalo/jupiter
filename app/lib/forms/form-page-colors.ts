export function formPageColors(dark: boolean, accentColor: string | null | undefined) {
  const backgroundColor = dark ? "#161616" : "#ffffff"
  const accent = accentColor ?? (dark ? "#f5f5f5" : "#262626")
  const strength = dark ? 0.1 : 0.05
  const themeColor = `#${[1, 3, 5].map((offset) => {
    const backgroundChannel = parseInt(backgroundColor.slice(offset, offset + 2), 16)
    const accentChannel = parseInt(accent.slice(offset, offset + 2), 16)
    return Math.round(backgroundChannel * (1 - strength) + accentChannel * strength).toString(16).padStart(2, "0")
  }).join("")}`

  return { backgroundColor, themeColor }
}
