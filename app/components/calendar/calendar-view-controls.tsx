import { CalendarDayLayoutSwitch } from "~/components/calendar/day-layout-switch"
import { CalendarDateControls } from "~/components/calendar/date-controls"
import { CalendarViewSwitch } from "~/components/calendar/view-switch"
import { CalendarMemberSelect } from "~/components/calendar/calendar-member-select"
import { cn } from "~/lib/utils"

export function CalendarViewControls({ className, mobile = false }: { className?: string, mobile?: boolean }) {
  // CSS chooses the visible controls, so their state must match before hydration
  return <div className={cn("@container/calendar-controls flex w-full min-w-0 shrink-0 items-center justify-between max-md:flex-wrap gap-3", className)} data-slot="calendar-view-controls">
    <div className="flex min-w-0 flex-1 items-center gap-3 max-md:w-full">
      <CalendarDateControls mobile={mobile} />
      <CalendarViewSwitch mobile={mobile} />
      <CalendarDayLayoutSwitch mobile={mobile} />
    </div>
    <div className="flex w-56 min-w-0 items-center max-md:w-full">
      <CalendarMemberSelect mobile={mobile} />
    </div>
  </div>
}
