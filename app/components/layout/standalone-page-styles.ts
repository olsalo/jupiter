import { cn } from "~/lib/utils"

export function getStandalonePageStyles(isElectron: boolean) {
  return cn(
    "[--page-gutter:1.25rem] md:[--page-gutter:1rem]",
    isElectron
      ? "[--page-top:calc(52px+env(safe-area-inset-top,0px))] md:[--page-top:calc(3rem+env(safe-area-inset-top,0px))]"
      : "[--page-top:calc(var(--page-gutter)+env(safe-area-inset-top,0px))]",
  )
}

export const standalonePagePadding = "px-(--page-gutter) pt-(--page-top) pb-5 md:pb-[calc(1rem+var(--tappable-inset-bottom,0px))]"

export const standalonePageLogoClassName = "isolate flex size-8 shrink-0 transform-gpu items-center justify-center rounded-lg bg-primary text-primary-foreground md:size-9"
