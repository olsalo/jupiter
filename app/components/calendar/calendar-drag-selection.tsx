import type { CalendarAppointment, CalendarDragSelection, CalendarMember } from "~/lib/calendar/types"
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { CalendarAppointmentCard } from "~/components/calendar/calendar-appointment"

import { calendarDateToValue } from "~/lib/calendar/date"
import { calendarIntervalMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { getCalendarBookingDragDuration } from "~/lib/calendar/booking-duration-steps"
import { calendarTimelinePadding } from "~/lib/calendar/timeline-layout"
import type { FormatPreference } from "~/lib/localization/format-preference"

export function CalendarDragLane({ day, timeZone, mobile = false, horizontal = false, member, startMinute, endMinute, blocked, formatPreference, onSelect, onSelectStart, onSelectUpdate, onSelectCancel, onDraggingChange, children, getDraftService, serviceDurations, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes }: {
  day: Date
  getDraftService?: (length: number) => CalendarAppointment["service"] | undefined
  serviceDurations?: readonly number[]
  intervalMinutes?: number
  minDurationMinutes?: number
  mobile?: boolean
  horizontal?: boolean
  timeZone: string
  member: CalendarMember
  startMinute: number
  endMinute: number
  blocked: { startMinute: number; endMinute: number }[]
  formatPreference: FormatPreference
  onDraggingChange?: (dragging: boolean) => void
  onSelect?: (selection: CalendarDragSelection) => void
  onSelectStart?: () => void
  onSelectUpdate?: (selection: CalendarDragSelection) => void
  onSelectCancel?: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const minimumDuration = minDurationMinutes
  const drag = useRef<{ pointerId: number; anchor: number; lower: number; upper: number; origin: number; started: boolean; selection: CalendarDragSelection | null } | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (commitTimer.current !== null) clearTimeout(commitTimer.current)
  }, [])
  const [selection, setSelection] = useState<CalendarDragSelection | null>(null)
  const minuteAt = (element: HTMLElement, y: number) => {
    const bounds = element.getBoundingClientRect()
    return startMinute + (horizontal ? (y - bounds.left) / bounds.width : (y - bounds.top) / bounds.height) * (endMinute - startMinute)
  }
  const rangeAt = (element: HTMLElement, y: number): CalendarDragSelection | null => {
    const current = drag.current
    if (!current) return null
    const lower = current.lower
    if (current.upper - lower < minimumDuration) return null
    const anchor = Math.max(lower, current.anchor)
    const minute = Math.max(lower, Math.min(current.upper, minuteAt(element, y)))
    let start = Math.max(lower, Math.min(anchor, Math.floor(minute / intervalMinutes) * intervalMinutes))
    let end = Math.min(current.upper, Math.max(anchor + intervalMinutes, Math.ceil(minute / intervalMinutes) * intervalMinutes))
    if (minute - lower <= intervalMinutes / 2) start = lower
    if (current.upper - minute <= intervalMinutes / 2) end = current.upper
    if (end - start < minimumDuration) {
      end = Math.min(current.upper, start + minimumDuration)
      start = Math.max(lower, end - minimumDuration)
    }
    if (serviceDurations !== undefined) {
      const backwards = minute < anchor
      const fixed = backwards ? end : start
      const duration = getCalendarBookingDragDuration({
        requestedDuration: backwards ? fixed - minute : minute - fixed,
        maxDuration: backwards ? fixed - lower : current.upper - fixed,
        serviceDurations, intervalMinutes, minDurationMinutes,
      })
      if (duration === null) return null
      start = backwards ? fixed - duration : fixed
      end = backwards ? fixed : fixed + duration
    }
    if (end - start < minimumDuration) return null
    return { day: calendarDateToValue(day), member, startMinute: start, endMinute: end }
  }
  const draft: CalendarAppointment | null = selection ? {
    id: "calendar-drag-selection", day: selection.day, memberId: member.id,
    customerName: t("calendarGrid.draftBooking"), startMinute: selection.startMinute, endMinute: selection.endMinute,
    service: getDraftService?.(selection.endMinute - selection.startMinute) ?? { id: "", name: "", color: "#808080" }, draft: true,
  } : null
  const cancelSelection = () => {
    const current = drag.current
    if (!current) return
    drag.current = null
    if (current.started) onSelectCancel?.()
    onDraggingChange?.(false)
    setSelection(null)
  }

  const updateCursor = (event: PointerEvent<HTMLDivElement>) => {
    const minute = minuteAt(event.currentTarget, horizontal ? event.clientX : event.clientY)
    const unavailable = minute < startMinute || minute >= endMinute || blocked.some((range) => minute >= range.startMinute && minute < range.endMinute)
    const canCreate = onSelect && !mobile && event.pointerType !== "touch" && window.matchMedia("(hover: hover) and (pointer: fine)").matches
    event.currentTarget.style.cursor = canCreate && (drag.current || !unavailable) ? "crosshair" : "default"
  }

  return <div className="relative min-w-0 cursor-default" data-day={calendarDateToValue(day)} data-member-id={member.id} data-slot="calendar-member-lane" style={horizontal ? { height: "100%" } : { marginBlock: calendarTimelinePadding }}
    onPointerEnter={updateCursor}
    onPointerLeave={(event) => { if (!drag.current) event.currentTarget.style.cursor = "default" }}
    onPointerDown={(event) => {
      if (!onSelect || event.button !== 0 || event.pointerType === "touch" || (event.target as HTMLElement).closest('[data-slot="calendar-appointment"]')) return
      const minute = minuteAt(event.currentTarget, (horizontal ? event.clientX : event.clientY))
      if (minute < startMinute || minute >= endMinute || blocked.some((range) => minute >= range.startMinute && minute < range.endMinute)) return
      const lower = Math.max(startMinute, ...blocked.filter((range) => range.endMinute <= minute).map((range) => range.endMinute))
      const upper = Math.min(endMinute, ...blocked.filter((range) => range.startMinute >= minute).map((range) => range.startMinute))
      if (upper - lower < minimumDuration) return
      const gridAnchor = Math.floor(minute / intervalMinutes) * intervalMinutes
      const anchor = Math.max(lower, Math.min(upper - minimumDuration, minute - lower <= intervalMinutes / 2 ? lower : gridAnchor))
      drag.current = { pointerId: event.pointerId, anchor, lower, upper, origin: (horizontal ? event.clientX : event.clientY), started: false, selection: null }
      onDraggingChange?.(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
    }}
    onPointerMove={(event) => {
      updateCursor(event)
      if (drag.current?.pointerId !== event.pointerId || Math.abs((horizontal ? event.clientX : event.clientY) - drag.current.origin) < 4) return
      if (!drag.current.started) {
        drag.current.started = true
        onSelectStart?.()
      }
      const range = rangeAt(event.currentTarget, (horizontal ? event.clientX : event.clientY))
      if (!range || !drag.current || (drag.current.selection?.startMinute === range.startMinute && drag.current.selection.endMinute === range.endMinute)) return
      drag.current.selection = range
      setSelection(range)
      onSelectUpdate?.(range)
    }}
    onPointerUp={(event) => {
      if (drag.current?.pointerId !== event.pointerId) return
      const range = drag.current.started || Math.abs((horizontal ? event.clientX : event.clientY) - drag.current.origin) >= 4 ? rangeAt(event.currentTarget, (horizontal ? event.clientX : event.clientY)) : null
      if (range && !drag.current.started) onSelectStart?.()
      if (!range && drag.current.started) onSelectCancel?.()
      drag.current = null
      onDraggingChange?.(false)
      if (range) {
        // Opening a panel during pointerup lets the release click dismiss it
        // Finish this gesture before handing the draft to the booking form
        setSelection(range)
        commitTimer.current = setTimeout(() => {
          commitTimer.current = null
          setSelection(null)
          onSelect?.(range)
        }, 0)
      } else setSelection(null)
    }}
    onPointerCancel={cancelSelection}
    onLostPointerCapture={cancelSelection}
  >
    {children}
    {draft && !onSelectUpdate ? <div className="pointer-events-none absolute inset-0 select-none"><CalendarAppointmentCard appointment={draft} horizontal={horizontal} endMinute={endMinute} formatPreference={formatPreference} startMinute={startMinute} /></div> : null}
  </div>
}
