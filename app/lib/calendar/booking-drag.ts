import { calendarIntervalMinutes, calendarMinDurationMinutes } from "./time-step.ts"

import { getCalendarBookingDragDuration } from "./booking-duration-steps.ts"

type BookingDragRange = { startMinute: number; endMinute: number }
export type CalendarBookingDragPhase = "start" | "move" | "drop" | "cancel"

export function getCalendarBookingResizeRange({ minute, bookingStartMinute, startMinute, endMinute, blocked, serviceDurations, serviceDurationMinutes, beforeMinutes = 0, afterMinutes = 0, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes }: {
  minute: number
  bookingStartMinute: number
  startMinute: number
  endMinute: number
  blocked: BookingDragRange[]
  serviceDurations?: readonly number[]
  serviceDurationMinutes?: number
  beforeMinutes?: number
  afterMinutes?: number
  intervalMinutes?: number
  minDurationMinutes?: number
}) {
  if (bookingStartMinute - beforeMinutes < startMinute) return null
  if (blocked.some((range) => range.startMinute <= bookingStartMinute && range.endMinute > bookingStartMinute - beforeMinutes)) return null
  const limit = Math.min(endMinute, ...blocked.filter((range) => range.startMinute > bookingStartMinute).map((range) => range.startMinute)) - afterMinutes
  const maxDuration = Math.min(1440, limit - bookingStartMinute)
  if (maxDuration < minDurationMinutes) return null
  const duration = getCalendarBookingDragDuration({ requestedDuration: minute - bookingStartMinute, maxDuration, serviceDurations, serviceDurationMinutes, intervalMinutes, minDurationMinutes })
  if (duration === null) return null
  return { startMinute: bookingStartMinute, endMinute: bookingStartMinute + duration }
}

export function getCalendarBookingDragRange({ minute, offset, durationMinutes, startMinute, endMinute, blocked, snapAround = [], isAvailable = () => true, snapToInterval = true, beforeMinutes = 0, afterMinutes = 0, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes }: {
  minute: number
  offset: number
  durationMinutes: number
  startMinute: number
  endMinute: number
  blocked: BookingDragRange[]
  intervalMinutes?: number
  minDurationMinutes?: number
  beforeMinutes?: number
  afterMinutes?: number
  snapToInterval?: boolean
  snapAround?: BookingDragRange[]
  isAvailable?: (range: BookingDragRange) => boolean
}) {
  if (durationMinutes < minDurationMinutes || durationMinutes > 1440 || durationMinutes + beforeMinutes + afterMinutes > endMinute - startMinute) return null
  const requestedStart = minute - offset
  const step = snapToInterval ? intervalMinutes : 1
  const firstStart = Math.ceil((startMinute + beforeMinutes) / step) * step
  const lastStart = Math.floor((endMinute - durationMinutes - afterMinutes) / step) * step
  const start = Math.max(firstStart, Math.min(lastStart, Math.round(requestedStart / step) * step))
  const intended = { startMinute: start, endMinute: start + durationMinutes }
  const overlaps = (a: BookingDragRange, b: BookingDragRange) => a.startMinute < b.endMinute && a.endMinute > b.startMinute
  const occupiedRange = (range: BookingDragRange) => ({ startMinute: range.startMinute - beforeMinutes, endMinute: range.endMinute + afterMinutes })
  const available = (range: BookingDragRange) => range.startMinute - beforeMinutes >= startMinute && range.endMinute + afterMinutes <= endMinute
    && !blocked.some((block) => overlaps(occupiedRange(range), block)) && isAvailable(range)

  // Merge neighbouring reservations, including their buffers, before finding free edges
  const occupied: BookingDragRange[] = []
  for (const range of [...snapAround].sort((a, b) => a.startMinute - b.startMinute)) {
    const previous = occupied.at(-1)
    if (previous && range.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, range.endMinute)
    else occupied.push({ ...range })
  }
  const intendedAvailable = available(intended)
  const edges = occupied.flatMap((range) => [
    range.startMinute - durationMinutes - afterMinutes,
    range.endMinute + beforeMinutes,
  ].filter((edge) => Math.abs(edge - requestedStart) <= intervalMinutes / 2 || (!intendedAvailable && overlaps(occupiedRange(intended), range))))
    .map((start) => ({ startMinute: start, endMinute: start + durationMinutes }))
    .filter(available)
    .sort((a, b) => Math.abs(a.startMinute - requestedStart) - Math.abs(b.startMinute - requestedStart) || a.startMinute - b.startMinute)
  const edge = edges[0]
  if (edge && (!snapToInterval || !intendedAvailable || Math.abs(edge.startMinute - requestedStart) <= Math.abs(start - requestedStart))) return edge
  return intendedAvailable ? intended : null
}

export function getCalendarDragScrollDelta(pointer: { x: number; y: number }, bounds: { left: number; top: number; width: number; height: number }, elapsedMs: number) {
  const edge = 56
  const speed = 720
  const axis = (position: number, start: number, size: number) => {
    if (size <= 0 || position < start - edge || position > start + size + edge) return 0
    const zone = Math.min(edge, size / 3)
    const distance = position < start + zone ? position - start : start + size - position
    if (distance >= zone) return 0
    const strength = Math.min(1, Math.max(0, 1 - distance / zone))
    const direction = position < start + zone ? -1 : 1
    return direction * strength * strength * speed * Math.min(32, Math.max(0, elapsedMs)) / 1000
  }
  return {
    left: pointer.y >= bounds.top - edge && pointer.y <= bounds.top + bounds.height + edge ? axis(pointer.x, bounds.left, bounds.width) : 0,
    top: pointer.x >= bounds.left - edge && pointer.x <= bounds.left + bounds.width + edge ? axis(pointer.y, bounds.top, bounds.height) : 0,
  }
}

export type CalendarBookingDragBounds = { left: number; top: number; width: number; height: number }

export function getCalendarBookingDragPosition(booking: CalendarBookingDragBounds, viewport: CalendarBookingDragBounds) {
  return {
    left: Math.max(viewport.left, Math.min(viewport.left + Math.max(0, viewport.width - booking.width), booking.left)),
    top: Math.max(viewport.top, Math.min(viewport.top + Math.max(0, viewport.height - booking.height), booking.top)),
  }
}
