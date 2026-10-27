import type { ReactNode } from "react"

import { cn } from "~/lib/utils"

export function CalendarView({ alerts, children, list = false }: {
  alerts?: ReactNode
  children?: ReactNode
  list?: boolean
}) {
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3" data-slot="calendar-view">
    {alerts}
    {children ? <div
      className={cn(
        "relative isolate z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background max-md:rounded-none max-md:border-0",
        // Clip fixed drag/return layers immediately when the side panel resizes the calendar
        !list && "[clip-path:inset(0)]",
        list && "max-md:overflow-visible max-md:bg-transparent",
      )}
      data-slot="calendar-container"
    >{children}</div> : null}
  </div>
}
