export const formAccentColors = [
  { name: "strawberry", color: "#dc2626", foreground: "#ffffff" },
  { name: "orange", color: "#f97316", foreground: "#431407" },
  { name: "mango", color: "#facc15", foreground: "#713f12" },
  { name: "lime", color: "#84cc16", foreground: "#2f4612" },
  { name: "kiwi", color: "#15803d", foreground: "#ffffff" },
  { name: "blueberry", color: "#2563eb", foreground: "#ffffff" },
  { name: "grape", color: "#7c3aed", foreground: "#ffffff" },
  { name: "raspberry", color: "#be185d", foreground: "#ffffff" },
] as const

export function formAccentForeground(color: string) {
  const preset = formAccentColors.find((item) => item.color === color.toLowerCase())
  if (preset) return preset.foreground

  const background = luminance(color)
  if (contrast(background, 1) >= 4.5) return "#ffffff"

  // Light custom accents get a darker ink in the same hue, with readable contrast.
  for (const shade of [0.3, 0.24, 0.18, 0.12, 0.06, 0.02]) {
    const ink = `#${channels(color).map((channel) => Math.round(channel * shade).toString(16).padStart(2, "0")).join("")}`
    if (contrast(background, luminance(ink)) >= 4.5) return ink
  }
  return "#050505"
}

function channels(color: string) {
  return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16))
}

function luminance(color: string) {
  const [red, green, blue] = channels(color).map((value) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

function contrast(first: number, second: number) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
