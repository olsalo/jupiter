import type { CalendarAppointment } from "~/components/calendar/calendar-appointment"

import type { CalendarBookingDragBounds } from "~/lib/calendar-booking-drag"

export type CalendarBookingDragPreview = {
  appointment: CalendarAppointment
  viewport: CalendarBookingDragBounds
  left: number
  top: number
  width: number
  height: number
  returning: boolean
}

// Pointer frames update only the floating card, leaving the calendar grid untouched
export function createCalendarBookingDragPreview() {
  let snapshot: CalendarBookingDragPreview | null = null
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => null,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setSnapshot(next: CalendarBookingDragPreview | null) {
      if (snapshot === next) return
      snapshot = next
      for (const listener of listeners) listener()
    },
  }
}

export type CalendarBookingDragPreviewStore = ReturnType<typeof createCalendarBookingDragPreview>
