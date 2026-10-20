import assert from "node:assert/strict"

import { getCalendarTimelineLayout } from "../app/lib/calendar/timeline-layout.ts"
import type { CalendarAppointment } from "../app/lib/calendar/types.ts"

const appointment = (id: string, startMinute: number, endMinute: number, changes: Partial<CalendarAppointment> = {}): CalendarAppointment => ({
  id, day: "2026-10-14", memberId: "alice", customerName: "Aino", startMinute, endMinute,
  status: "CONFIRMED", service: { id: "service", name: "Consultation", color: "#30968d" }, ...changes,
})
const first = appointment("first", 600, 660)
const overlapping = appointment("overlapping", 630, 690)
const cancelled = appointment("cancelled", 600, 660, { memberId: "bob", status: "CANCELLED" })
const draft = appointment("draft", 720, 750, { draft: true })
const missingMember = appointment("missing", 600, 660, { memberId: "archived" })
const appointments = [overlapping, cancelled, first, draft, missingMember]
const original = structuredClone(appointments)
const input = {
  days: [new Date(2026, 9, 14), new Date(2026, 9, 15)],
  members: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }],
  appointments,
  conflictAppointments: appointments,
  unavailableDays: [{ day: "2026-10-15", memberId: "bob" }],
  unavailableTimes: [
    { day: "2026-10-14", memberId: "alice", startMinute: 480, endMinute: 540 },
    { day: "2026-10-14", memberId: "alice", startMinute: 780, endMinute: 810 },
    { day: "2026-10-14", memberId: "archived", startMinute: 780, endMinute: 810 },
  ],
  startMinute: 540, endMinute: 1020, allowSimultaneousBookings: false, excludeDraftConflicts: false,
}
const layout = getCalendarTimelineLayout(input)
assert.deepEqual(layout.map(({ date }) => date), ["2026-10-14", "2026-10-15"])
assert.deepEqual(layout[0].lanes.map(({ member }) => member.id), ["alice", "bob"])
const alice = layout[0].lanes[0]
assert.deepEqual(alice.appointments.map(({ id }) => id), ["first", "overlapping", "draft"], "Only the lane's own bookings are sorted and placed")
assert.deepEqual(alice.appointments.slice(0, 2).map(({ columns, column }) => ({ columns, column })), [{ columns: 2, column: 0 }, { columns: 2, column: 1 }], "Overlapping bookings retain separate columns")
assert.ok(alice.blocked.includes(first) && alice.blocked.includes(draft), "Active and draft bookings reserve their lane")
assert.deepEqual(alice.unavailableTimes.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })), [{ startMinute: 780, endMinute: 810 }], "Unavailable shading includes only visible intervals")
assert.ok(alice.blocked.some(({ startMinute }) => startMinute === 480), "Offscreen unavailability still constrains range selection")
assert.equal(layout[0].lanes[1].appointments[0].id, cancelled.id, "Cancelled bookings still render")
assert.equal(layout[0].lanes[1].blocked.length, 0, "Cancelled bookings do not reserve time")
assert.deepEqual(layout[1].lanes[1].unavailableTimes, [{ day: "2026-10-15", memberId: "bob", startMinute: 540, endMinute: 1020 }], "Unavailable days cover the displayed time range")
const simultaneous = getCalendarTimelineLayout({ ...input, allowSimultaneousBookings: true })
assert.ok(!simultaneous[0].lanes[0].blocked.includes(first) && simultaneous[0].lanes[0].blocked.length === 2, "Simultaneous bookings retain unavailable times while allowing overlaps")
assert.ok(!getCalendarTimelineLayout({ ...input, excludeDraftConflicts: true })[0].lanes[0].blocked.includes(draft), "A new range can replace the existing draft")
assert.deepEqual(appointments, original, "Preparing a layout never mutates saved bookings")
assert.deepEqual(getCalendarTimelineLayout({ ...input, members: [] }).map(({ lanes }) => lanes.length), [0, 0], "Empty calendars retain date columns without inventing members")

const breakPeriod = { day: "2026-10-14", memberId: "alice", startMinute: 750, endMinute: 780 }
const withBreak = getCalendarTimelineLayout({ ...input, breaks: [breakPeriod], allowSimultaneousBookings: true })
assert.deepEqual(withBreak[0].lanes[0].breaks, [breakPeriod])
assert.ok(withBreak[0].lanes[0].blocked.includes(breakPeriod), "Breaks block selection even when simultaneous bookings are enabled")
assert.equal(withBreak[0].lanes[1].breaks.length, 0, "A personal break is visible only on its member's lane")
console.info("PASS indexed calendar lanes, overlaps, unavailable times, drafts, simultaneous bookings and immutable inputs")
