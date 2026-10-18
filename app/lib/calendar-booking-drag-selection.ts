import type { CalendarBookingDragUpdate } from "~/components/calendar/calendar-booking-preview"

// A newer drag for another booking supersedes the outgoing route's initial state too
export function getCalendarBookingDragSelection(
  update: CalendarBookingDragUpdate | null | undefined,
  initial: CalendarBookingDragUpdate | undefined,
  appointmentId?: string,
) {
  const current = update ?? initial
  return current?.appointmentId === appointmentId ? current?.selection : undefined
}
