import type { ComponentProps } from "react"

import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

export function OverlayLoading({ label, className, "data-slot": slot = "overlay-loading", ...props }: Omit<ComponentProps<"div">, "children"> & { label: string; "data-slot"?: string }) {
  return <div {...props} className={cn("flex min-h-64 min-w-0 flex-1 items-center justify-center p-6", className)} data-slot={slot}>
    <Spinner aria-label={label} className="size-6" />
  </div>
}
