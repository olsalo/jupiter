import { cn } from "~/lib/utils"

export type SheetSide = "right" | "left" | "top" | "bottom"
export type SheetVariant = "default" | "inset"

export function getSheetViewportClassName({ className, side, variant = "default" }: {
  className?: string
  side?: SheetSide
  variant?: SheetVariant
}) {
  return cn(
    "pointer-events-none fixed inset-0 z-50 grid",
    side === "bottom" && "grid grid-rows-[1fr_auto] pt-12",
    side === "top" && "grid grid-rows-[auto_1fr] pb-12",
    side === "left" && "flex justify-start",
    side === "right" && "flex justify-end",
    variant === "inset" && "sm:p-2",
    className,
  )
}

export function getSheetPopupClassName({ className, side = "right", variant = "default" }: {
  className?: string
  side?: SheetSide
  variant?: SheetVariant
}) {
  return cn(
    "pointer-events-auto",
    "relative flex max-h-full min-h-0 w-full min-w-0 flex-col bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 transition-[opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:before:hidden dark:before:shadow-[0_-1px_--theme(--color-white/6%)] border-border",
    side === "bottom" && "row-start-2 border-t data-ending-style:translate-y-8 data-starting-style:translate-y-8",
    side === "top" && "data-ending-style:-translate-y-8 data-starting-style:-translate-y-8 border-b",
    side === "left" && "data-ending-style:-translate-x-8 data-starting-style:-translate-x-8 w-[calc(100%-(--spacing(12)))] max-w-md border-e",
    side === "right" && "col-start-2 w-[calc(100%-(--spacing(12)))] max-w-md border-s data-ending-style:translate-x-8 data-starting-style:translate-x-8",
    variant === "inset" && "before:hidden sm:rounded-xl sm:border sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=sheet-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]",
    className,
  )
}
