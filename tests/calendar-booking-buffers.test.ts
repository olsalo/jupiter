import assert from "node:assert/strict"

import { getCalendarBookingDragRange } from "../app/lib/calendar/booking-drag.ts"
import { getCalendarTimelineLayout } from "../app/lib/calendar/timeline-layout.ts"
import type { CalendarAppointment } from "../app/lib/calendar/types.ts"

const appointment: CalendarAppointment = {
  id: "completed", day: "2026-10-14", memberId: "alice", customerName: "Aino",
  startMinute: 600, endMinute: 660, status: "COMPLETED", bufferBeforeMinutes: 10, bufferAfterMinutes: 15,
  service: { id: "service", name: "Consultation", color: "#30968d" },
}
const input = {
  days: [new Date(2026, 9, 14)], members: [{ id: "alice", name: "Alice" }],
  appointments: [appointment], conflictAppointments: [appointment],
  unavailableDays: [], unavailableTimes: [], startMinute: 540, endMinute: 1020,
  allowSimultaneousBookings: false, excludeDraftConflicts: false,
}
for (const status of ["CONFIRMED", "COMPLETED"]) {
  const booking = { ...appointment, status }
  const lane = getCalendarTimelineLayout({ ...input, appointments: [booking], conflictAppointments: [booking] })[0].lanes[0]
  assert.deepEqual(lane.blocked.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })), [{ startMinute: 590, endMinute: 675 }], `${status} reserves its full time including preparation and cleanup for calendar selection`)
  for (const minute of [580, 595, 650, 665]) {
    const range = getCalendarBookingDragRange({ minute, offset: 0, durationMinutes: 30, startMinute: 540, endMinute: 1020, blocked: lane.blocked, snapAround: lane.blocked })
    assert.ok(range === null || range.endMinute <= 590 || range.startMinute >= 675, `${status} prevents dragging a booking into either buffer`)
  }
}
for (const status of ["CANCELLED", "NO_SHOW"]) {
  assert.deepEqual(getCalendarTimelineLayout({ ...input, conflictAppointments: [{ ...appointment, status }] })[0].lanes[0].blocked, [], `${status} releases reserved time`)
}
assert.deepEqual(getCalendarTimelineLayout({ ...input, allowSimultaneousBookings: true })[0].lanes[0].blocked, [], "Explicit simultaneous bookings still allow overlaps")
console.info("PASS confirmed and completed booking buffers block calendar selection and dragging consistently")
