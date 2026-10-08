import { cn } from "~/lib/utils"

export function getDialogViewportClassName({
  className,
  centered = true,
  bottomStickOnMobile = false,
}: {
  className?: string
  centered?: boolean
  bottomStickOnMobile?: boolean
} = {}) {
  return cn(
    "pointer-events-none fixed inset-0 z-50 grid grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] justify-items-center p-4",
    !centered && "grid-rows-[1fr_auto_3fr]",
    bottomStickOnMobile && "max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12",
    className,
  )
}

export function getDialogPopupClassName({
  className,
  bottomStickOnMobile = false,
}: {
  className?: string
  bottomStickOnMobile?: boolean
} = {}) {
  return cn(
    "pointer-events-auto",
    "-translate-y-[calc(1.25rem*var(--nested-dialogs))] relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-top scale-[calc(1-0.1*var(--nested-dialogs))] flex-col rounded-2xl border border-border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-0.1*var(--nested-dialogs))] shadow-lg/5 transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-nested:data-ending-style:translate-y-8 data-nested:data-starting-style:translate-y-8 data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
    bottomStickOnMobile && "max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:opacity-[calc(1-min(var(--nested-dialogs),1))] max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none",
    className,
  )
}
