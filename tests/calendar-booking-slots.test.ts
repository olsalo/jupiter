import assert from "node:assert/strict"

import { getClosestBookingSlot, getCalendarBookingEditSlot, includeCurrentBookingSlot } from "../app/lib/calendar/booking-slots.ts"

const current = { date: "2026-10-14", slot: { startsAt: "2026-10-14T05:33:00.000Z", endsAt: "2026-10-14T06:33:00.000Z", staffMemberId: "alice", locationId: null } }
const other = { ...current.slot, startsAt: "2026-10-14T08:00:00.000Z", endsAt: "2026-10-14T09:00:00.000Z" }
const days = [{ date: current.date, slots: [other] }]
const included = includeCurrentBookingSlot(days, current)
assert.equal(included[0].slots.length, 2, "The saved booking time is included even when it falls between availability intervals")
assert.deepEqual(included[0].slots[1], current.slot)
assert.equal(days[0].slots.length, 1, "The shared availability cache is not mutated")
assert.equal(includeCurrentBookingSlot(included, current), included, "An already available current time is not duplicated")
assert.deepEqual(includeCurrentBookingSlot([], current), [{ date: current.date, slots: [current.slot] }], "The current booking time remains visible when there are no other available slots")
assert.equal(includeCurrentBookingSlot(days), days, "Changing to another date or member leaves availability untouched")
console.info("PASS current booking time, off-interval starts, empty availability, deduplication and cache isolation")

const slotAt = (time: string) => ({ ...other, startsAt: `2026-10-15T${time}:00.000Z`, endsAt: "2026-10-15T15:00:00.000Z" })
const earlier = slotAt("08:30")
const later = slotAt("09:30")
assert.equal(getClosestBookingSlot([later, earlier], new Date("2026-10-15T08:30Z")), earlier, "An available time is preserved on the selected date")
assert.equal(getClosestBookingSlot([earlier, later], new Date("2026-10-15T09:15Z")), later, "An unavailable time moves to the closest valid start")
assert.equal(getClosestBookingSlot([later, earlier], new Date("2026-10-15T09:00Z")), earlier, "Equally close times prefer the earlier start regardless of list order")
assert.equal(getClosestBookingSlot([later], new Date("2026-10-15T08:30Z")), later, "A longer booking can move to the nearest start that fits its full duration")
assert.equal(getClosestBookingSlot([], new Date("2026-10-15T09:00Z")), undefined, "A fully booked date has no selection")
assert.equal(getClosestBookingSlot([earlier], new Date(NaN)), undefined)
const otherMember = { ...earlier, staffMemberId: "bob" }
assert.equal(getClosestBookingSlot([otherMember, earlier], new Date(earlier.startsAt), earlier.staffMemberId), earlier, "Whole-team availability preserves the current member when both offer the selected time")
assert.equal(getClosestBookingSlot([earlier, otherMember], new Date(earlier.startsAt), otherMember.staffMemberId), otherMember, "Member preference does not depend on the order of results")
assert.equal(getClosestBookingSlot([earlier, { ...otherMember, startsAt: later.startsAt }], new Date(earlier.startsAt), otherMember.staffMemberId), earlier, "The closest time takes priority over the preferred member")
console.info("PASS exact times, closest available starts, deterministic ties, duration changes and empty dates")

assert.equal(getCalendarBookingEditSlot([otherMember, later], new Date(earlier.startsAt), later.staffMemberId), later, "Editing a length preserves the assigned member even when another member has a closer time")
assert.equal(getCalendarBookingEditSlot([otherMember], new Date(earlier.startsAt), earlier.staffMemberId), undefined, "An unavailable member never falls back to another member")
assert.equal(getCalendarBookingEditSlot([otherMember, earlier], new Date(earlier.startsAt), earlier.staffMemberId, `${otherMember.startsAt}/${otherMember.staffMemberId}/`), otherMember, "Explicitly choosing another member's time remains supported")
console.info("PASS stable member assignment during booking edits")
