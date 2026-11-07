import assert from "node:assert/strict"
import { getCalendarSchedule, type CalendarScheduleRule } from "../app/lib/calendar/schedule.ts"
import { getCalendarTimelineLayout } from "../app/lib/calendar/timeline-layout.ts"
import { calendarDateFromValue, getCalendarDateState } from "../app/lib/calendar/date.ts"
import { businessHolidayWindows } from "../app/lib/business/business-holidays.server.ts"
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

const closure: CalendarScheduleRule = { staffMemberId: null, isBlocked: true, title: "Holiday", windows: timeOffIntervals({ ...values, allDay: true }, timeZone).map((entry) => ({ start: +entry.startsAt, end: +entry.endsAt })) }
const noHours: CalendarScheduleRule = { staffMemberId: "alice", windows: [] }
const closedSchedule = getCalendarSchedule({ ...options, rules: [noHours, closure] })
assert.deepEqual(closedSchedule.unavailableTimes.filter((period) => period.memberId === "alice"), [{ day, memberId: "alice", isBlocked: true, title: "Holiday", startMinute: 0, endMinute: 1440 }], "A business closure replaces empty member schedule shading")
const closedLayout = getCalendarTimelineLayout({ days: options.days, members: [{ id: "alice", name: "Alice" }], appointments: [], conflictAppointments: [], unavailableDays: [], unavailableTimes: closedSchedule.unavailableTimes, startMinute: closedSchedule.startMinute, endMinute: closedSchedule.endMinute, allowSimultaneousBookings: true, excludeDraftConflicts: false })
assert.equal(closedLayout[0].lanes[0].unavailableTimes.length, 1, "The calendar renders only the holiday unavailability")
assert.equal(closedLayout[0].lanes[0].unavailableTimes[0].title, "Holiday")
const shorterHours: CalendarScheduleRule = { staffMemberId: "alice", windows: timeOffIntervals({ ...values, startTime: "10:00", endTime: "15:00" }, timeZone).map((entry) => ({ start: +entry.startsAt, end: +entry.endsAt })) }
const closedWithHours = getCalendarSchedule({ ...options, rules: [shorterHours, closure] })
assert.deepEqual(closedWithHours.unavailableTimes.filter((period) => period.memberId === "alice"), [{ day, memberId: "alice", isBlocked: true, title: "Holiday", startMinute: 0, endMinute: 1440 }], "A business closure also replaces gaps around recurring member hours")
const withoutClosure = getCalendarSchedule({ ...options, rules: [noHours] })
assert.deepEqual(withoutClosure.unavailableTimes.filter((period) => period.memberId === "alice"), [{ day, memberId: "alice", startMinute: 540, endMinute: 1020 }], "An empty schedule still shades days without a business closure")
const personalClosure = getCalendarSchedule({ ...options, rules: [noHours, blocked({ ...values, allDay: true })] })
assert.equal(personalClosure.unavailableTimes.filter((period) => period.memberId === "alice").length, 2, "Personal time off does not trigger business closure handling")
const partialClosure = getCalendarSchedule({ ...options, rules: [noHours, { ...blocked(values), staffMemberId: null }] })
assert.equal(partialClosure.unavailableTimes.filter((period) => period.memberId === "alice").length, 2, "Partial business closures retain unavailable shading outside the closure")

const currentWeek = getCalendarDateState(new URLSearchParams({ date: "2026-10-31", view: "week" }), { timeZone })
const holidayRules: CalendarScheduleRule[] = businessHolidayWindows(null, currentWeek.range.from, currentWeek.range.to, timeZone).map((holiday) => ({
  staffMemberId: null, isBlocked: !holiday.isOpen, isExtra: holiday.isOpen, title: holiday.holidayId, windows: [{ start: holiday.start, end: holiday.end }],
}))
const saturdayHours: CalendarScheduleRule = { staffMemberId: "alice", windows: timeOffIntervals({ ...values, startDate: "2026-10-31", endDate: "2026-10-31", startTime: "10:00", endTime: "15:00" }, timeZone).map((entry) => ({ start: +entry.startsAt, end: +entry.endsAt })) }
const currentWeekSchedule = getCalendarSchedule({ ...options, days: currentWeek.days, rules: [saturdayHours, ...holidayRules] })
const currentWeekLayout = getCalendarTimelineLayout({ days: currentWeekSchedule.days, members: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }], appointments: [], conflictAppointments: [], unavailableDays: [], unavailableTimes: currentWeekSchedule.unavailableTimes, startMinute: currentWeekSchedule.startMinute, endMinute: currentWeekSchedule.endMinute, allowSimultaneousBookings: false, excludeDraftConflicts: false })
const holidayLanes = currentWeekLayout.find((entry) => entry.date === "2026-10-31")!.lanes
for (const lane of holidayLanes) {
  assert.equal(lane.unavailableTimes.length, 1, "The October 31 week column shows one holiday overlay per member")
  assert.equal(lane.unavailableTimes[0].title, "allSaints", "Both scheduled and unscheduled members display only All Saints' Day")
}
console.log("Calendar blocked time schedule checks passed")
