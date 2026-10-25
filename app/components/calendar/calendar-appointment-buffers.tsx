import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "~/lib/utils"
import type { CalendarAppointment } from "~/lib/calendar/types"

export function CalendarAppointmentBuffers({ appointment, startMinute, endMinute, horizontal, floating = false }: {
  appointment: CalendarAppointment
  startMinute: number
  endMinute: number
  horizontal: boolean
  floating?: boolean
}) {
  const { t } = useTranslation("services")
  if (endMinute <= startMinute || appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") return null

  const ranges = [
    { key: "before", label: t("bufferBeforeMinutes"), start: appointment.startMinute - (appointment.bufferBeforeMinutes ?? 0), end: appointment.startMinute },
    { key: "after", label: t("bufferAfterMinutes"), start: appointment.endMinute, end: appointment.endMinute + (appointment.bufferAfterMinutes ?? 0) },
  ]
  const column = appointment.column ?? 0
  const columns = appointment.columns ?? 1

  return ranges.map((range) => {
    const start = floating ? range.start : Math.max(startMinute, range.start)
    const end = floating ? range.end : Math.min(endMinute, range.end)
    if (end <= start) return null

    const offset = (start - startMinute) / (endMinute - startMinute) * 100
    const length = (end - start) / (endMinute - startMinute) * 100
    const before = range.key === "before"
    const ratio = (end - start) / (appointment.endMinute - appointment.startMinute)
    const floatingLength = `calc(${ratio * 100}% + ${ratio * 4 + (before ? 0 : 4)}px)`
    const floatingStyle: CSSProperties = horizontal ? {
      top: 0, height: "100%", width: floatingLength,
      ...(before ? { right: "100%" } : { left: "100%" }),
    } : {
      left: 0, right: 0, height: floatingLength,
      ...(before ? { bottom: "100%" } : { top: "100%" }),
    }
    return <div
      aria-label={`${appointment.customerName} · ${range.label}`}
      className={cn("pointer-events-none absolute z-5 border border-gray-200/70 bg-gray-100 dark:border-gray-700/60 dark:bg-gray-800", horizontal ? before ? "rounded-l-md border-r-0" : "rounded-r-md border-l-0" : before ? "rounded-t-md border-b-0" : "rounded-b-md border-t-0")}
      data-buffer-appointment-id={appointment.id}
      data-buffer={range.key}
      data-slot="calendar-appointment-buffer"
      key={range.key}
      role="note"
      style={floating ? floatingStyle : horizontal ? {
        left: `calc(${offset}% + ${before ? 2 : -2}px)`,
        width: `max(1px, calc(${length}% + ${before ? 1 : 4}px))`,
        top: `calc(${column / columns * 100}% + 4px)`,
        height: `calc(${100 / columns}% - 8px)`,
      } : {
        top: before ? `${offset}%` : `calc(${offset}% - 4px)`,
        height: `max(1px, calc(${length}% + ${before ? 1 : 4}px))`,
        left: `calc(${column / columns * 100}% + var(--calendar-card-inset, 4px))`,
        right: `calc(${(1 - (column + 1) / columns) * 100}% + var(--calendar-card-inset, 4px))`,
      }}
    />
  })
}
