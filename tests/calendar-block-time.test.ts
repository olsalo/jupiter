import assert from "node:assert/strict"
import { getCalendarSchedule, type CalendarScheduleRule } from "../app/lib/calendar/schedule.ts"
import { getCalendarTimelineLayout } from "../app/lib/calendar/timeline-layout.ts"
import { calendarDateFromValue } from "../app/lib/calendar/date.ts"
import { timeOffIntervals, type TimeOffValues } from "../app/lib/team/team-time-off.ts"

const timeZone = "Europe/Helsinki"
const day = "2030-10-14"
const values: TimeOffValues = { title: "Lunch", startDate: day, endDate: day, allDay: false, startTime: "12:00", endTime: "13:00", repeat: "none", repeatUntil: "" }
const blocked = (values: TimeOffValues): CalendarScheduleRule => ({ staffMemberId: "alice", isBlocked: true, title: values.title, windows: timeOffIntervals(values, timeZone).map((entry) => ({ start: +entry.startsAt, end: +entry.endsAt })) })
const options = { days: [calendarDateFromValue(day, timeZone)], members: [{ id: "alice" }, { id: "bob" }], timeZone, defaultStartMinute: 540, defaultEndMinute: 1020 }
const schedule = getCalendarSchedule({ ...options, rules: [blocked(values)] })
assert.equal(schedule.startMinute, 540, "Blocked time does not replace inherited working hours")
assert.equal(schedule.endMinute, 1020)
assert.deepEqual(schedule.unavailableTimes, [{ day, memberId: "alice", isBlocked: true, title: "Lunch", startMinute: 720, endMinute: 780 }], "Only the selected person's time is blocked")
const fullDay = getCalendarSchedule({ ...options, rules: [blocked({ ...values, allDay: true })] })
assert.deepEqual(fullDay.unavailableTimes, [{ day, memberId: "alice", isBlocked: true, title: "Lunch", startMinute: 0, endMinute: 1440 }], "Full-day time off blocks the entire day")
const recurring = { ...values, repeat: "weekly" as const, repeatUntil: "2030-11-01" }
const repeatDay = "2030-10-28"
const repeated = getCalendarSchedule({ ...options, days: [calendarDateFromValue(repeatDay, timeZone)], rules: [blocked(recurring)] })
assert.deepEqual(repeated.unavailableTimes, [{ day: repeatDay, memberId: "alice", isBlocked: true, title: "Lunch", startMinute: 720, endMinute: 780 }], "Recurring blocks preserve local time across daylight saving changes")
const layout = getCalendarTimelineLayout({ days: options.days, members: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }], appointments: [], conflictAppointments: [], unavailableDays: [], unavailableTimes: schedule.unavailableTimes, startMinute: schedule.startMinute, endMinute: schedule.endMinute, allowSimultaneousBookings: true, excludeDraftConflicts: false })
assert.equal(layout[0].lanes[0].blocked[0].startMinute, 720, "Blocked time still prevents range selection when simultaneous bookings are enabled")
assert.equal(layout[0].lanes[0].unavailableTimes[0].title, "Lunch", "The block title reaches the calendar display")
assert.equal(layout[0].lanes[1].blocked.length, 0)
console.log("Calendar blocked time schedule checks passed")
