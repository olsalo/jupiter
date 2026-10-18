import { useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { CalendarAppointmentCard, type CalendarAppointment } from "~/components/calendar/calendar-appointment"
import type { CalendarMember } from "~/components/calendar/week-calendar"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar-date"
import type { FormatPreference } from "~/lib/format-preference"

export type CalendarDragSelection = { day: string; member: CalendarMember; startMinute: number; endMinute: number }

export function CalendarDragLane({ day, timeZone, member, startMinute, endMinute, blocked, formatPreference, onSelect, onDraggingChange, children }: {
  day: Date
  timeZone: string
  member: CalendarMember
  startMinute: number
  endMinute: number
  blocked: { startMinute: number; endMinute: number }[]
  formatPreference: FormatPreference
  onDraggingChange?: (dragging: boolean) => void
  onSelect?: (selection: CalendarDragSelection) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const drag = useRef<{ pointerId: number; anchor: number; lower: number; upper: number; origin: number } | null>(null)
  const [selection, setSelection] = useState<CalendarDragSelection | null>(null)
  const minuteAt = (element: HTMLElement, y: number) => {
    const bounds = element.getBoundingClientRect()
    return startMinute + (y - bounds.top) / bounds.height * (endMinute - startMinute)
  }
  const rangeAt = (element: HTMLElement, y: number): CalendarDragSelection | null => {
    const current = drag.current
    if (!current) return null
    const minute = Math.max(current.lower, Math.min(current.upper, minuteAt(element, y)))
    return { day: calendarDateToValue(day), member, startMinute: Math.min(current.anchor, Math.floor(minute / 5) * 5), endMinute: Math.max(current.anchor + 5, Math.ceil(minute / 5) * 5) }
  }
  const draft: CalendarAppointment | null = selection ? {
    id: "calendar-drag-selection", day: selection.day, memberId: member.id,
    customerName: t("calendarGrid.draftBooking"), startMinute: selection.startMinute, endMinute: selection.endMinute,
    service: { id: "", name: "", color: "#808080" }, draft: true,
  } : null

  return <div className={onSelect ? "relative min-w-0 cursor-crosshair" : "relative min-w-0"} data-day={calendarDateToValue(day)} data-member-id={member.id} data-slot="calendar-member-lane" style={{ marginBlock: 8 }}
    onPointerDown={(event) => {
      if (!onSelect || event.button !== 0 || event.pointerType === "touch" || (event.target as HTMLElement).closest('[data-slot="calendar-appointment"]')) return
      const anchor = Math.floor(minuteAt(event.currentTarget, event.clientY) / 5) * 5
      const startsAt = calendarDateFromValue(calendarDateToValue(day), timeZone)
      startsAt.setHours(Math.floor(anchor / 60), anchor % 60, 0, 0)
      if (+startsAt <= Date.now()) return
      if (anchor < startMinute || anchor + 5 > endMinute || blocked.some((range) => anchor < range.endMinute && anchor + 5 > range.startMinute)) return
      const lower = Math.max(startMinute, ...blocked.filter((range) => range.endMinute <= anchor).map((range) => range.endMinute))
      const upper = Math.min(endMinute, ...blocked.filter((range) => range.startMinute >= anchor + 5).map((range) => range.startMinute))
      drag.current = { pointerId: event.pointerId, anchor, lower: Math.ceil(lower / 5) * 5, upper: Math.floor(upper / 5) * 5, origin: event.clientY }
      onDraggingChange?.(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    }}
    onPointerMove={(event) => {
      if (drag.current?.pointerId !== event.pointerId || Math.abs(event.clientY - drag.current.origin) < 4) return
      setSelection(rangeAt(event.currentTarget, event.clientY))
    }}
    onPointerUp={(event) => {
      if (drag.current?.pointerId !== event.pointerId) return
      const range = Math.abs(event.clientY - drag.current.origin) >= 4 ? rangeAt(event.currentTarget, event.clientY) : null
      drag.current = null
      onDraggingChange?.(false)
      setSelection(null)
      if (range) onSelect?.(range)
    }}
    onPointerCancel={() => { if (drag.current) onDraggingChange?.(false); drag.current = null; setSelection(null) }}
    onLostPointerCapture={() => { if (drag.current) onDraggingChange?.(false); drag.current = null; setSelection(null) }}
  >
    {children}
    {draft ? <div className="pointer-events-none absolute inset-0 select-none"><CalendarAppointmentCard appointment={draft} endMinute={endMinute} formatPreference={formatPreference} startMinute={startMinute} /></div> : null}
  </div>
}
