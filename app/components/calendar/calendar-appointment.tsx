import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import { Card } from "~/components/ui/card"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

export type CalendarAppointment = {
  id: string
  day: string
  memberId: string
  customerName: string
  startMinute: number
  endMinute: number
  movable?: boolean
  durationMinutes?: number
  service: { id: string; name: string; color: string }
  status?: string
  column?: number
  columns?: number
  draft?: boolean
  creationDraft?: boolean
}

export function CalendarAppointmentCard({ appointment, startMinute, endMinute, formatPreference, canDrag = false, floating = false, dragging = false, hidden = false }: {
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
  const status = appointment.status ? t(`calendarGrid.statuses.${appointment.status}`) : ""
  const label = [appointment.customerName, appointment.service.name, time, status].filter(Boolean).join(" · ")

  return <Card
    className={cn("absolute inset-x-1 z-10 gap-0 overflow-hidden rounded-md border-[color-mix(in_srgb,var(--appointment-color)_32%,var(--background))] bg-[color-mix(in_srgb,var(--appointment-color)_18%,var(--background))] px-2 py-1 pl-3.5 text-foreground shadow-none before:hidden dark:bg-[color-mix(in_srgb,var(--appointment-color)_24%,var(--background))]", duration < 45 && "py-0.5", appointment.status === "CANCELLED" && "border-dashed opacity-60", appointment.status === "NO_SHOW" && "opacity-60", appointment.draft && "border-dashed", appointment.draft && !floating && "motion-safe:animate-[calendar-draft-pulse_3s_ease-in-out_infinite]", dragging && "shadow-xl ring-1 ring-black/10", hidden && "invisible")}
    data-draft={appointment.draft === true ? "true" : undefined}
    data-appointment-id={appointment.id}
    data-service-id={appointment.service.id}
    data-slot="calendar-appointment"
    data-status={appointment.status}
    draggable={false}
    onDragStart={(event) => event.preventDefault()}
    render={appointment.draft || floating ? <article aria-label={label} className={cn("select-none", canDrag && "cursor-grab active:cursor-grabbing")} title={label} /> : <Link draggable={false} aria-label={label} className={cn("cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", canDrag && "cursor-grab active:cursor-grabbing")} preventScrollReset={true} title={label} to={`/calendar/${encodeURIComponent(appointment.id)}/edit${search}`} />}
    aria-hidden={hidden || floating ? true : undefined}
    style={{
      "--appointment-color": appointment.service.color,
      top: `${(start - startMinute) / (endMinute - startMinute) * 100}%`,
      height: `calc(${duration / (endMinute - startMinute) * 100}% - 4px)`,
      left: `calc(${(appointment.column ?? 0) / (appointment.columns ?? 1) * 100}% + 4px)`,
      right: `calc(${(1 - ((appointment.column ?? 0) + 1) / (appointment.columns ?? 1)) * 100}% + 4px)`,
      ...(floating ? { top: 0, left: 0, right: 0, height: "100%" } : {}),
    } as CSSProperties}
  >
    <span aria-hidden={true} className="absolute inset-y-1 left-1 w-1 rounded-md bg-(--appointment-color)" />
    <span className="truncate text-[10px] leading-3 tabular-nums">{time}</span>
    {duration >= 30 ? <span className="truncate text-xs leading-3.5 font-semibold">{appointment.customerName}</span> : null}
    {duration >= 45 ? <span className="truncate text-[11px] leading-3 opacity-75">{appointment.service.name}</span> : null}
    {duration >= 60 && status ? <span className="truncate text-[10px] leading-3 opacity-75">{status}</span> : null}
  </Card>
}
