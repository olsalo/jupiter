import type { CalendarAppointment } from "~/lib/calendar/types"
import { memo, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import { CalendarBookingIssueMarker } from "~/components/calendar/calendar-booking-issues"
import { Card } from "~/components/ui/card"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

export const CalendarAppointmentCard = memo(function CalendarAppointmentCard({ appointment, startMinute, endMinute, formatPreference, canDrag = false, floating = false, dragging = false, hidden = false, horizontal = false }: {
  horizontal?: boolean
  appointment: CalendarAppointment
  canDrag?: boolean
  floating?: boolean
  dragging?: boolean
  hidden?: boolean
  startMinute: number
  endMinute: number
  formatPreference: FormatPreference
}) {
  const { t, i18n } = useTranslation()
  const { search } = useLocation()
  const start = Math.max(startMinute, appointment.startMinute)
  const end = Math.min(endMinute, appointment.endMinute)
  if (end <= start || endMinute <= startMinute) return null
  const duration = end - start
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference, language, timeZone: "UTC", includeDate: false })
  const time = `${formatTime(appointment.startMinute)} – ${formatTime(appointment.endMinute)}`
  const status = appointment.status && appointment.status !== "CONFIRMED" ? t(`calendarGrid.statuses.${appointment.status}`) : ""
  const label = [appointment.customerName, appointment.service.name, time, status].filter(Boolean).join(" · ")

  // Keep the hidden source hit-testable so another drag can interrupt its return animation
  return <Card
    className={cn("absolute inset-x-1 z-10 gap-0 overflow-hidden rounded-md border-[color-mix(in_srgb,var(--appointment-color)_32%,var(--background))] bg-[color-mix(in_srgb,var(--appointment-color)_18%,var(--background))] px-2 py-1 pl-3.5 text-foreground shadow-none before:hidden dark:bg-[color-mix(in_srgb,var(--appointment-color)_24%,var(--background))]", !floating && !hidden && "after:pointer-events-none after:absolute after:inset-0 after:bg-foreground/0 after:transition-colors after:duration-150 [@media(hover:hover)]:hover:after:bg-foreground/4 [@media(hover:none)]:active:after:bg-foreground/4 motion-reduce:after:transition-none", !horizontal && duration < 45 && "py-0.5", appointment.status === "CANCELLED" && "border-dashed opacity-60", appointment.status === "NO_SHOW" && "opacity-60", appointment.draft && "border-dashed", appointment.draft && !floating && !hidden && "motion-safe:animate-[calendar-draft-pulse_3s_ease-in-out_infinite]", dragging && "shadow-xl ring-1 ring-black/10", hidden && "opacity-0")}
    data-draft={appointment.draft === true ? "true" : undefined}
    data-appointment-id={appointment.id}
    data-service-id={appointment.service.id}
    data-slot="calendar-appointment"
    data-status={appointment.status}
    draggable={false}
    onDragStart={(event) => event.preventDefault()}
    render={appointment.draft || floating ? <article aria-label={label} className={cn("select-none", canDrag && "cursor-grab active:cursor-grabbing")} /> : <Link draggable={false} aria-label={label} className={cn("cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", canDrag && "cursor-grab active:cursor-grabbing")} preventScrollReset={true} to={`/calendar/${encodeURIComponent(appointment.id)}/edit${search}`} />}
    aria-hidden={hidden || floating ? true : undefined}
    tabIndex={hidden ? -1 : undefined}
    style={{
      "--appointment-color": appointment.service.color,
      top: `${(start - startMinute) / (endMinute - startMinute) * 100}%`,
      height: `calc(${duration / (endMinute - startMinute) * 100}% - 4px)`,
      left: `calc(${(appointment.column ?? 0) / (appointment.columns ?? 1) * 100}% + var(--calendar-card-inset, 4px))`,
      right: `calc(${(1 - ((appointment.column ?? 0) + 1) / (appointment.columns ?? 1)) * 100}% + var(--calendar-card-inset, 4px))`,
      ...(horizontal ? {
        left: `calc(${(start - startMinute) / (endMinute - startMinute) * 100}% + 2px)`,
        width: `calc(${duration / (endMinute - startMinute) * 100}% - 4px)`,
        right: "auto",
        top: `calc(${(appointment.column ?? 0) / (appointment.columns ?? 1) * 100}% + 4px)`,
        height: `calc(${100 / (appointment.columns ?? 1)}% - 8px)`,
      } : {}),
      ...(floating ? { top: 0, left: 0, right: 0, height: "100%", ...(horizontal ? { width: "100%" } : {}) } : {}),
    } as CSSProperties}
  >
    <span aria-hidden={true} className="absolute inset-y-1 left-1 w-1 rounded-md bg-(--appointment-color)" />
    <span className="flex min-w-0 items-center justify-between gap-1 text-[10px] leading-3 tabular-nums"><span className="truncate">{time}</span><CalendarBookingIssueMarker issues={appointment.availabilityIssues} /></span>
    {horizontal || duration >= 30 ? <span className="truncate text-xs leading-3.5 font-semibold">{appointment.customerName}</span> : null}
    {horizontal || duration >= 45 ? <span className="truncate text-[11px] leading-3 opacity-75">{appointment.service.name}</span> : null}
    {!horizontal && duration >= 60 && status ? <span className="truncate text-[10px] leading-3 opacity-75">{status}</span> : null}
    {canDrag && !floating && appointment.startMinute >= startMinute && appointment.endMinute <= endMinute && (appointment.durationMinutes ?? duration) === duration ? <span
      aria-hidden={true}
      className={horizontal ? "absolute inset-y-0 right-0 flex w-2 cursor-ew-resize items-center justify-center" : "absolute inset-x-0 bottom-0 flex h-2 cursor-ns-resize items-center justify-center"}
      data-slot="calendar-booking-resize-handle"
    ><span className={horizontal ? "h-5 w-0.5 rounded-full bg-foreground/30" : "h-0.5 w-5 rounded-full bg-foreground/30"} /></span> : null}
  </Card>
}, (previous, next) => {
  if (previous.startMinute !== next.startMinute || previous.endMinute !== next.endMinute || previous.formatPreference !== next.formatPreference
    || previous.horizontal !== next.horizontal || previous.canDrag !== next.canDrag || previous.floating !== next.floating || previous.dragging !== next.dragging || previous.hidden !== next.hidden) return false
  if (previous.appointment === next.appointment) return true
  const fields = Object.keys(next.appointment) as (keyof CalendarAppointment)[]
  return fields.length === Object.keys(previous.appointment).length && fields.every((field) => Object.is(previous.appointment[field], next.appointment[field]))
})
