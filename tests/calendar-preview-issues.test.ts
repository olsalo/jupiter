import assert from "node:assert/strict"
import { getCalendarAppointmentPosition, getCalendarPreviewIssues } from "../app/lib/calendar/preview-issues.ts"
import type { CalendarScheduleRule } from "../app/lib/calendar/schedule.ts"

const window = (date: string, start: string, end: string) => ({ start: Date.parse(`${date}T${start}:00Z`), end: Date.parse(`${date}T${end}:00Z`) })
const rules: CalendarScheduleRule[] = [
  { staffMemberId: null, windows: [window("2099-10-28", "09:00", "17:00"), window("2099-10-29", "09:00", "17:00")] },
  { staffMemberId: "alice", isBreak: true, windows: [window("2099-10-28", "10:00", "10:30")] },
]
const options = { rules, timeZone: "UTC", defaultStartMinute: 540, defaultEndMinute: 1020, now: Date.parse("2026-10-20T00:00:00Z") }
const position = { startsAt: "2099-10-28T10:00:00Z", endsAt: "2099-10-28T10:30:00Z", memberId: "alice", status: "CONFIRMED" }
assert.deepEqual(getCalendarPreviewIssues(position, options), ["overlapsBreak"])
assert.deepEqual(getCalendarPreviewIssues({ ...position, memberId: "bob" }, options), [], "Moving members uses the target member's break schedule")
assert.deepEqual(getCalendarPreviewIssues({ ...position, startsAt: "2099-10-28T10:30:00Z", endsAt: "2099-10-28T11:00:00Z" }, options), [], "Moving out of a break removes the warning")
assert.deepEqual(getCalendarPreviewIssues({ ...position, startsAt: "2099-10-29T10:00:00Z", endsAt: "2099-10-29T10:30:00Z" }, options), [], "Moving dates uses that date's schedule")
assert.deepEqual(getCalendarPreviewIssues({ ...position, startsAt: "2099-10-28T09:30:00Z", endsAt: "2099-10-28T10:10:00Z" }, options), ["overlapsBreak"], "Resizing into a break adds a warning")
assert.deepEqual(getCalendarPreviewIssues({ ...position, startsAt: "2099-10-28T16:30:00Z", endsAt: "2099-10-28T17:30:00Z" }, options), ["outsideWorkingHours"], "Resizing outside working hours adds a warning")
const extra = { staffMemberId: "alice", locationId: "office", isExtra: true, windows: [window("2099-10-28", "18:00", "19:00")] }
const late = { ...position, startsAt: "2099-10-28T18:00:00Z", endsAt: "2099-10-28T18:30:00Z" }
assert.deepEqual(getCalendarPreviewIssues({ ...late, locationId: "office" }, { ...options, rules: [...rules, extra] }), [], "Extra availability respects the booking location")
assert.deepEqual(getCalendarPreviewIssues({ ...late, locationId: "other" }, { ...options, rules: [...rules, extra] }), ["outsideWorkingHours"])
assert.deepEqual(getCalendarPreviewIssues(position, { ...options, rules: [...rules, { staffMemberId: "alice", windows: [] }] }), ["outsideWorkingHours", "overlapsBreak"], "Explicit closed schedules do not fall back to business hours")
const appointment = { id: "booking", day: "2099-10-28", memberId: "bob", locationId: "office", startMinute: 600, endMinute: 615, durationMinutes: 60, status: "CONFIRMED", customerName: "Aino", service: { id: "service", name: "Service", color: "#808080" } }
assert.equal(getCalendarAppointmentPosition(appointment, "Europe/Helsinki").startsAt.toISOString(), "2099-10-28T08:00:00.000Z")
assert.equal(getCalendarAppointmentPosition(appointment, "Europe/Helsinki").endsAt.toISOString(), "2099-10-28T09:00:00.000Z", "Drag checks the full booking duration")
console.log("Calendar preview issue checks passed")
