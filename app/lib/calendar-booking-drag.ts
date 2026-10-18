type BookingDragRange = { startMinute: number; endMinute: number }

export function getCalendarBookingDragRange({ minute, offset, durationMinutes, startMinute, endMinute, blocked, snapAround = [], isAvailable = () => true }: {
  minute: number
  offset: number
  durationMinutes: number
  startMinute: number
  endMinute: number
  blocked: BookingDragRange[]
  snapAround?: BookingDragRange[]
  isAvailable?: (range: BookingDragRange) => boolean
}) {
  if (durationMinutes < 5 || durationMinutes > endMinute - startMinute) return null
  const start = Math.max(startMinute, Math.min(endMinute - durationMinutes, Math.round((minute - offset) / 5) * 5))
  const intended = { startMinute: start, endMinute: start + durationMinutes }
  const overlaps = (a: BookingDragRange, b: BookingDragRange) => a.startMinute < b.endMinute && a.endMinute > b.startMinute
  const available = (range: BookingDragRange) => range.startMinute >= startMinute && range.endMinute <= endMinute
    && !blocked.some((block) => overlaps(range, block)) && isAvailable(range)
  if (available(intended)) return intended

  // Treat touching bookings as one occupied stretch so a drop can sit beside the group
  const occupied: BookingDragRange[] = []
  for (const range of [...snapAround].sort((a, b) => a.startMinute - b.startMinute)) {
    const previous = occupied.at(-1)
    if (previous && range.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, range.endMinute)
    else occupied.push({ ...range })
  }
  const candidates = occupied.filter((range) => overlaps(intended, range)).flatMap((range) => [
    Math.floor((range.startMinute - durationMinutes) / 5) * 5,
    Math.ceil(range.endMinute / 5) * 5,
  ]).map((start) => ({ startMinute: start, endMinute: start + durationMinutes }))
    .filter(available)
    .sort((a, b) => Math.abs(a.startMinute - start) - Math.abs(b.startMinute - start) || a.startMinute - b.startMinute)
  return candidates[0] ?? null
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
