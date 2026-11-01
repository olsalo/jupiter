import assert from "node:assert/strict"

import { getCalendarTimelineLayout } from "../app/lib/calendar/timeline-layout.ts"
import type { CalendarUnavailableTime } from "../app/lib/calendar/types.ts"

const period = { day: "2026-10-14", memberId: "alice", startMinute: 720, endMinute: 780 }
const original = structuredClone(period)
const range = (startMinute: number, endMinute: number): CalendarUnavailableTime => ({ ...period, startMinute, endMinute })
const input = {
  days: [new Date(2026, 9, 14), new Date(2026, 9, 15)],
  members: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }],
  appointments: [],
  conflictAppointments: [],
  unavailableDays: [],
  breaks: [period],
  startMinute: 540,
  endMinute: 1020,
  allowSimultaneousBookings: false,
  excludeDraftConflicts: false,
}
const visibleBreaks = (unavailableTimes: CalendarUnavailableTime[]) => getCalendarTimelineLayout({ ...input, unavailableTimes })[0].lanes[0].breaks

assert.deepEqual(visibleBreaks([]), [period], "Available breaks remain visible")
assert.deepEqual(visibleBreaks([range(700, 800)]), [], "Fully unavailable breaks are hidden")
assert.deepEqual(visibleBreaks([range(720, 780)]), [], "An exact unavailable match hides the break")
assert.deepEqual(visibleBreaks([range(700, 740)]), [range(740, 780)], "Unavailability clips the start of a break")
assert.deepEqual(visibleBreaks([range(760, 800)]), [range(720, 760)], "Unavailability clips the end of a break")
assert.deepEqual(visibleBreaks([range(740, 760)]), [range(720, 740), range(760, 780)], "A break is split around unavailable time")
assert.deepEqual(visibleBreaks([range(750, 770), range(730, 760)]), [range(720, 730), range(770, 780)], "Overlapping unavailable ranges are removed regardless of order")
assert.deepEqual(visibleBreaks([range(700, 720), range(780, 800)]), [period], "Touching boundaries preserve the break")
assert.deepEqual(visibleBreaks([{ ...range(700, 800), isBlocked: true }]), [], "Blocked time hides breaks too")
assert.deepEqual(visibleBreaks([{ ...range(700, 800), memberId: "bob" }, { ...range(700, 800), day: "2026-10-15" }]), [period], "Other members and dates do not hide a break")
assert.deepEqual(getCalendarTimelineLayout({ ...input, unavailableTimes: [], unavailableDays: [{ day: period.day, memberId: period.memberId }] })[0].lanes[0].breaks, [], "Full-day unavailability hides breaks")
assert.deepEqual(period, original, "Clipping does not mutate the original break")

console.info("PASS calendar break visibility for full-day, partial, overlapping and member-specific unavailability")
