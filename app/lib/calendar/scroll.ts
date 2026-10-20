type ScrollBounds = {
  left: number
  top: number
  width: number
  height: number
}

type CalendarScrollViewport = {
  scrollLeft: number
  scrollTop: number
  scrollWidth: number
  scrollHeight: number
  clientWidth: number
  clientHeight: number
  getBoundingClientRect: () => ScrollBounds
}

export function getCalendarTimeScrollLeft({ minute, startMinute, endMinute, gridWidth, viewportWidth, padding = 0 }: {
  minute: number
  startMinute: number
  endMinute: number
  gridWidth: number
  viewportWidth: number
  padding?: number
}) {
  const ratio = Math.max(0, Math.min(1, (minute - startMinute) / Math.max(1, endMinute - startMinute)))
  const maxLeft = Math.max(0, gridWidth + padding * 2 - viewportWidth)
  return Math.max(0, Math.min(maxLeft, padding + ratio * gridWidth - viewportWidth / 2))
}

export function getCalendarTodayScrollLeft(days: string[], today: string, gridWidth: number, viewportWidth: number) {
  const index = days.indexOf(today)
  if (index === -1) return null
  return Math.max(0, Math.min(gridWidth - viewportWidth, (index + 0.5) * gridWidth / days.length - viewportWidth / 2))
}

export function getCalendarBookingScrollPosition(viewport: CalendarScrollViewport, lane: ScrollBounds, booking: ScrollBounds) {
  const bounds = viewport.getBoundingClientRect()
  return {
    left: Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + lane.left - bounds.left + lane.width / 2 - viewport.clientWidth / 2)),
    top: Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + booking.top - bounds.top + booking.height / 2 - viewport.clientHeight / 2)),
  }
}

export function getCalendarBookingRevealScrollLeft(viewport: CalendarScrollViewport, booking: ScrollBounds) {
  const bounds = viewport.getBoundingClientRect()
  const right = bounds.left + viewport.clientWidth
  const bookingRight = booking.left + booking.width
  if (booking.left >= bounds.left && bookingRight <= right) return viewport.scrollLeft
  const padding = 12
  const delta = booking.left < bounds.left || booking.width > viewport.clientWidth - padding * 2
    ? booking.left - bounds.left - padding
    : bookingRight - right + padding
  return Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, viewport.scrollLeft + delta))
}

export function getCalendarBookingRevealScrollPosition(viewport: CalendarScrollViewport, booking: ScrollBounds) {
  const bounds = viewport.getBoundingClientRect()
  const bottom = bounds.top + viewport.clientHeight
  const padding = 12
  const delta = booking.top >= bounds.top && booking.top + booking.height <= bottom ? 0
    : booking.top < bounds.top || booking.height > viewport.clientHeight - padding * 2
      ? booking.top - bounds.top - padding
      : booking.top + booking.height - bottom + padding
  return {
    left: getCalendarBookingRevealScrollLeft(viewport, booking),
    top: Math.max(0, Math.min(viewport.scrollHeight - viewport.clientHeight, viewport.scrollTop + delta)),
  }
}
