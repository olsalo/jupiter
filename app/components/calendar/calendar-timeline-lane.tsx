import type { CalendarTimelineProps } from "~/components/calendar/calendar-timeline"
import { memo } from "react"
import { useTranslation } from "react-i18next"

import { CalendarBreakCard } from "~/components/calendar/calendar-break"
import { CalendarAppointmentCard } from "~/components/calendar/calendar-appointment"
import { CalendarDragLane } from "~/components/calendar/calendar-drag-selection"
import { Badge } from "~/components/ui/badge"
import { calendarTimelineHourHeight, calendarTimelinePadding, type CalendarTimelineLaneData } from "~/lib/calendar/timeline-layout"
import type { CalendarDragSelection } from "~/lib/calendar/types"
import type { FormatPreference } from "~/lib/localization/format-preference"
import { cn } from "~/lib/utils"

export const CalendarTimelineLane = memo(function CalendarTimelineLane({ lane, mobile, canMoveBookings, hiddenAppointmentIds, startMinute, endMinute, timeZone, formatPreference, onDraggingChange, onSelect, onSelectStart, onSelectUpdate, onSelectCancel, getDraftService, serviceDurations, intervalMinutes, minDurationMinutes }: {
  lane: CalendarTimelineLaneData
  getDraftService?: CalendarTimelineProps["getDraftService"]
  serviceDurations?: readonly number[]
  intervalMinutes?: number
  minDurationMinutes?: number
  mobile: boolean
  canMoveBookings: boolean
  hiddenAppointmentIds: Set<string>
  startMinute: number
  endMinute: number
  timeZone: string
  formatPreference: FormatPreference
  onDraggingChange?: (dragging: boolean) => void
  onSelect?: (selection: CalendarDragSelection) => void
  onSelectStart?: () => void
  onSelectUpdate?: (selection: CalendarDragSelection) => void
  onSelectCancel?: () => void
}) {
  const { t } = useTranslation()
  return <div className={cn("grid min-w-0", mobile ? "[--calendar-card-inset:0px]" : "border-r border-foreground/5 last:border-r-0")}>
    <CalendarDragLane getDraftService={getDraftService} serviceDurations={serviceDurations} intervalMinutes={intervalMinutes} minDurationMinutes={minDurationMinutes} blocked={lane.blocked} day={lane.day} endMinute={endMinute} formatPreference={formatPreference} member={lane.member} mobile={mobile} onDraggingChange={onDraggingChange} onSelect={onSelect} onSelectCancel={onSelectCancel} onSelectStart={onSelectStart} onSelectUpdate={onSelectUpdate} startMinute={startMinute} timeZone={timeZone}>
      {lane.unavailableTimes.filter((period) => !mobile || period.isBlocked).map((unavailable, index) => {
        const top = (Math.max(startMinute, unavailable.startMinute) - startMinute) / 60 * calendarTimelineHourHeight - (unavailable.startMinute <= startMinute ? calendarTimelinePadding : 0)
        const bottom = (Math.min(endMinute, unavailable.endMinute) - startMinute) / 60 * calendarTimelineHourHeight + (unavailable.endMinute >= endMinute ? calendarTimelinePadding : 0)
        return <div
          aria-label={`${lane.member.name} · ${unavailable.title || t("calendarGrid.unavailable")}`}
          className="absolute inset-0 flex items-center justify-center overflow-hidden bg-foreground/1 px-1.5"
          data-slot="calendar-unavailable-lane"
          key={index}
          role="note"
          style={{
            top,
            bottom: "auto",
            height: bottom - top,
            backgroundImage: "repeating-linear-gradient(135deg, transparent 0px, transparent 5px, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 5px, color-mix(in srgb, var(--muted-foreground) 8%, transparent) 6px)",
          }}
        >
          {Math.min(endMinute, unavailable.endMinute) - Math.max(startMinute, unavailable.startMinute) >= 30 ? <Badge className="absolute top-1/2 left-1/2 z-40 max-w-[calc(100%-0.75rem)] -translate-x-1/2 -translate-y-1/2 border-border/50 bg-background/80 px-1.5 text-[10px] text-muted-foreground dark:bg-background/80" data-slot="calendar-unavailable-badge" variant="outline">{unavailable.title || t("calendarGrid.unavailable")}</Badge> : null}
        </div>
      })}
      {lane.breaks.map((period, index) => <CalendarBreakCard endMinute={endMinute} formatPreference={formatPreference} key={index} period={period} startMinute={startMinute} />)}
      {lane.appointments.map((appointment) => <CalendarAppointmentCard appointment={appointment} canDrag={Boolean(canMoveBookings && appointment.movable)} endMinute={endMinute} formatPreference={formatPreference} hidden={hiddenAppointmentIds.has(appointment.id)} key={appointment.id} startMinute={startMinute} />)}
    </CalendarDragLane>
  </div>
})
