import { useEffect, type ComponentProps } from "react"

import { useFormPresentation } from "~/components/forms/use-form-presentation"
import { ScrollArea } from "~/components/ui/scroll-area"
import type { FormSnapshot } from "~/lib/forms/form-types"
import { cn } from "~/lib/utils"
import { syncThemeColor } from "~/lib/theme"

type FormScrollAreaProps = Pick<ComponentProps<typeof ScrollArea>, "children" | "className" | "render"> & {
  appearance: FormSnapshot["appearance"] | undefined
  showGradient?: boolean
  syncDocumentTheme?: boolean
}

export function FormScrollArea({ appearance, children, className, render, showGradient = true, syncDocumentTheme = false }: FormScrollAreaProps) {
  const presentation = useFormPresentation(appearance)
  const { backgroundColor, colorScheme } = presentation.documentStyle
  const themeColor = showGradient ? presentation.documentStyle["--page-theme-color"] : backgroundColor

  useEffect(() => {
    if (!syncDocumentTheme) return

    document.documentElement.style.backgroundColor = backgroundColor
    document.documentElement.style.colorScheme = colorScheme
    document.documentElement.style.setProperty("--page-theme-color", themeColor)
    syncThemeColor()

    return () => {
      document.documentElement.style.removeProperty("background-color")
      document.documentElement.style.removeProperty("color-scheme")
      document.documentElement.style.removeProperty("--page-theme-color")
      syncThemeColor()
    }
  }, [syncDocumentTheme, backgroundColor, colorScheme, themeColor])

  return (
    <ScrollArea
      className={cn("text-foreground", presentation.canvasClassName, presentation.className, className)}
      fill={true}
      render={render}
      scrollbarClassName={presentation.scrollbarClassName}
      scrollbarGutter={false}
      scrollFade={true}
      style={{ ...presentation.style, ...(showGradient ? presentation.backgroundStyle : { backgroundColor }) }}
      viewportProps={{ className: "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" }}
    >
      {children}
    </ScrollArea>
  )
}
