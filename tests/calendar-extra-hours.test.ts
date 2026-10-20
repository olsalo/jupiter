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
console.log("Extra hours date validation, timezone and calendar checks passed")
