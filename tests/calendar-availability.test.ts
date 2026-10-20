import assert from "node:assert/strict"
import { removeScheduleAt, replaceScheduleAt, scheduleAt, type ScheduleRule } from "../app/lib/calendar/availability.ts"

const timezone = "Europe/Helsinki"
const first = new Date("2030-03-30T22:00:00Z")
const second = new Date("2030-04-06T21:00:00Z")
const middle = new Date("2030-04-02T21:00:00Z")
const rule: ScheduleRule = { dayOfWeek: 1, startMinute: 480, endMinute: 1020, timezone, isActive: true, validFrom: null, validUntil: null }
let rules = replaceScheduleAt([rule], [{ ...rule, startMinute: 600 }], first, timezone)
assert.equal(scheduleAt(rules, new Date(+first - 1))[0].startMinute, 480)
assert.equal(scheduleAt(rules, first)[0].startMinute, 600)
assert.equal(scheduleAt(rules, first).length, 1, "Version boundaries do not overlap")
rules = replaceScheduleAt(rules, [{ ...rule, startMinute: 720 }], second, timezone)
rules = replaceScheduleAt(rules, [{ ...rule, startMinute: 660 }], middle, timezone)
assert.equal(scheduleAt(rules, first)[0].startMinute, 600)
assert.equal(scheduleAt(rules, middle)[0].startMinute, 660)
assert.equal(scheduleAt(rules, second)[0].startMinute, 720, "Inserting a version preserves later changes")
rules = replaceScheduleAt(rules, [{ ...rule, startMinute: 690 }], middle, timezone)
assert.equal(scheduleAt(rules, middle).length, 1, "Editing the same effective date replaces that version")
assert.equal(scheduleAt(rules, middle)[0].startMinute, 690)
rules = replaceScheduleAt(rules, [], middle, timezone)
assert.equal(scheduleAt(rules, middle).length, 7)
assert.ok(scheduleAt(rules, middle).every((rule) => !rule.isActive), "A closed week overrides inherited hours")
assert.equal(scheduleAt(rules, second)[0].startMinute, 720)
const shifted = replaceScheduleAt(removeScheduleAt(rules, middle), [{ ...rule, startMinute: 690 }], new Date(+middle + 86400000), timezone)
assert.equal(scheduleAt(shifted, middle)[0].startMinute, 600, "Moving an upcoming change restores the previous schedule until its new date")
assert.equal(scheduleAt(shifted, new Date(+middle + 86400000))[0].startMinute, 690)
assert.equal(scheduleAt(shifted, second)[0].startMinute, 720, "Moving a change preserves subsequent versions")
console.log("Calendar availability version checks passed")
