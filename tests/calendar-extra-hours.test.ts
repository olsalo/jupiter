import assert from "node:assert/strict"
import { extraHoursInterval, extraHoursSchema } from "../app/lib/schemas/calendar-extra-hours.ts"
import { getCalendarSchedule, type CalendarScheduleRule } from "../app/lib/calendar/schedule.ts"
import { calendarDateFromValue } from "../app/lib/calendar/date.ts"

const schema = extraHoursSchema({ date: "Choose a date", time: "Choose a time", end: "Must be later" })
const values = { date: "2030-10-26", startTime: "10:00", endTime: "14:00" }
assert.equal(schema.safeParse(values).success, true)
assert.equal(schema.safeParse({ ...values, date: "" }).success, false)
assert.equal(schema.safeParse({ ...values, date: "2030-02-30" }).success, false)
assert.equal(schema.safeParse({ ...values, endTime: "10:00" }).success, false)
assert.equal(schema.safeParse({ ...values, endTime: "09:00" }).success, false)
assert.equal(schema.safeParse({ ...values, startTime: "25:00" }).success, false)
const beforeDst = extraHoursInterval(values, "Europe/Helsinki")
assert.equal(beforeDst.startsAt.toISOString(), "2030-10-26T07:00:00.000Z")
assert.equal(extraHoursInterval({ ...values, date: "2030-10-28" }, "Europe/Helsinki").startsAt.toISOString(), "2030-10-28T08:00:00.000Z")
const rule: CalendarScheduleRule = { staffMemberId: "alice", isExtra: true, windows: [{ start: +beforeDst.startsAt, end: +beforeDst.endsAt }] }
const options = { days: [calendarDateFromValue(values.date, "Europe/Helsinki")], members: [{ id: "alice" }, { id: "bob" }], rules: [rule], timeZone: "Europe/Helsinki", defaultStartMinute: 540, defaultEndMinute: 1020 }
const saturday = getCalendarSchedule(options)
assert.equal(saturday.days.length, 1, "A one-off Saturday shift makes that calendar day visible")
assert.equal(saturday.startMinute, 600)
assert.equal(saturday.endMinute, 840)
assert.deepEqual(saturday.unavailableTimes, [{ day: values.date, memberId: "bob", startMinute: 600, endMinute: 840 }], "Extra hours open only for the chosen member")
const business: CalendarScheduleRule = { staffMemberId: null, windows: [{ start: +beforeDst.startsAt - 3600000, end: +beforeDst.startsAt + 3600000 }] }
const overlap = getCalendarSchedule({ ...options, rules: [business, rule, { staffMemberId: "alice", isBreak: true, windows: [{ start: +beforeDst.startsAt, end: +beforeDst.startsAt + 1800000 }] }] })
assert.equal(overlap.breaks.length, 1, "Overlapping extra and regular hours do not duplicate breaks")
assert.deepEqual(overlap.unavailableTimes, [{ day: values.date, memberId: "bob", startMinute: 660, endMinute: 840 }])
const closure: CalendarScheduleRule = { staffMemberId: null, isBlocked: true, title: "Holiday", windows: [{ start: +calendarDateFromValue(values.date, options.timeZone), end: +calendarDateFromValue("2030-10-27", options.timeZone) }] }
const holiday = getCalendarSchedule({ ...options, rules: [closure, rule] })
assert.deepEqual(holiday.unavailableTimes.filter((period) => period.memberId === "alice").map(({ startMinute, endMinute, title }) => ({ startMinute, endMinute, title })), [
  { startMinute: 0, endMinute: 600, title: "Holiday" },
  { startMinute: 840, endMinute: 1440, title: "Holiday" },
], "Extra hours reopen only their window within a business closure")
assert.deepEqual(holiday.unavailableTimes.filter((period) => period.memberId === "bob").map(({ startMinute, endMinute }) => ({ startMinute, endMinute })), [{ startMinute: 0, endMinute: 1440 }], "Other members remain closed")
const personalBlock: CalendarScheduleRule = { ...rule, isExtra: false, isBlocked: true, title: "Time off" }
assert.ok(getCalendarSchedule({ ...options, rules: [closure, rule, personalBlock] }).unavailableTimes.some((period) => period.memberId === "alice" && period.title === "Time off" && period.startMinute === 600 && period.endMinute === 840), "Extra hours do not override personal time off")
assert.equal(getCalendarSchedule({ ...options, rules: [closure, { ...rule, staffMemberId: null }] }).unavailableTimes.filter((period) => period.startMinute === 0 && period.endMinute === 1440).length, 0, "Business-wide extra hours reopen all members")
console.log("Extra hours date validation, timezone and calendar checks passed")

const monday = "2026-10-12"
const midnight = +calendarDateFromValue(monday, "UTC")
const hour = 3600000
const mondayOptions = { days: [calendarDateFromValue(monday, "UTC")], members: [{ id: "alice" }], timeZone: "UTC", defaultStartMinute: 540, defaultEndMinute: 720 }
const businessHours: CalendarScheduleRule = { staffMemberId: null, windows: [{ start: midnight + 9 * hour, end: midnight + 12 * hour }] }
const futureHours: CalendarScheduleRule = { staffMemberId: "alice", validFrom: midnight + 24 * hour, windows: [] }
assert.deepEqual(getCalendarSchedule({ ...mondayOptions, rules: [businessHours, futureHours] }).unavailableTimes, [], "Future personal schedules preserve inherited calendar hours")
assert.deepEqual(getCalendarSchedule({ ...mondayOptions, rules: [futureHours] }).unavailableTimes, [], "Future personal schedules preserve default calendar hours when business rules are missing")
assert.deepEqual(getCalendarSchedule({ ...mondayOptions, rules: [businessHours, { ...futureHours, validFrom: null, validUntil: midnight }] }).unavailableTimes, [], "Expired personal schedules preserve inherited calendar hours")
assert.deepEqual(getCalendarSchedule({ ...mondayOptions, rules: [businessHours, { ...futureHours, validFrom: null, validUntil: midnight + 10 * hour }] }).unavailableTimes, [{ day: monday, memberId: "alice", startMinute: 540, endMinute: 600 }], "Disabled personal schedules block inherited hours only until their end date")
