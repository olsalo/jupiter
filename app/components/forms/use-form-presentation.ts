import type { CSSProperties } from "react"

import type { FormSnapshot } from "~/lib/forms/form-types"
import { formAccentForeground } from "~/lib/forms/form-accent-colors"
import { formPageColors } from "~/lib/forms/form-page-colors"
import { useMediaQuery } from "~/lib/hooks"

export function useFormPresentation(appearance: FormSnapshot["appearance"] | undefined) {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)")
  const theme = appearance?.theme ?? "LIGHT"
  const color = appearance?.accentColor
  const dark = theme === "DARK" || (theme === "SYSTEM" && systemDark)
  const { backgroundColor, themeColor } = formPageColors(dark, color)

  return {
    className: dark ? "dark scheme-dark" : "form-theme-light scheme-light",
    canvasClassName: "bg-background",
    scrollbarClassName: dark ? "[&_[data-slot=scroll-area-thumb]]:bg-foreground/30" : undefined,
    documentStyle: { backgroundColor, colorScheme: dark ? "dark" : "light", "--page-theme-color": themeColor } satisfies CSSProperties & { "--page-theme-color": string },
    style: color ? { "--primary": color, "--ring": color, "--primary-foreground": formAccentForeground(color) } as CSSProperties : undefined,
    backgroundStyle: {
      backgroundColor,
      backgroundImage: [
        `linear-gradient(to bottom, ${themeColor}, transparent 96px)`,
        `radial-gradient(ellipse at 12% 0%, color-mix(in srgb, var(--primary) ${dark ? 10 : 5}%, transparent), transparent 70%)`,
        `radial-gradient(ellipse at 88% 0%, color-mix(in srgb, var(--primary) ${dark ? 6 : 3}%, transparent), transparent 65%)`,
        `linear-gradient(to bottom, color-mix(in srgb, var(--primary) ${dark ? 6 : 3}%, transparent) 0%, color-mix(in srgb, var(--primary) ${dark ? 2 : 1}%, transparent) 45%, transparent 100%)`,
      ].join(", "),
      backgroundSize: "100% 480px",
      backgroundRepeat: "no-repeat",
    } satisfies CSSProperties,
  }
}
