import assert from "node:assert/strict"
import superjson from "superjson"

import { getCalendarEarliestBookingMinute, getCalendarTimeRange } from "../app/lib/calendar/date.ts"

for (const [day, expectedStart] of [
  ["2026-10-20", "2026-10-20T07:05:00.000Z"],
  ["2026-10-27", "2026-10-27T08:05:00.000Z"],
] as const) {
  const range = getCalendarTimeRange(day, 605, 45, "Europe/Helsinki")
  assert.equal(range.startsAt.constructor, Date, "Availability requests use native dates rather than timezone date subclasses")
  assert.equal(range.startsAt.toISOString(), expectedStart, "Dragged starts match UTC slot timestamps in both summer and winter")
  assert.equal(+range.endsAt - +range.startsAt, 45 * 60000)
  const transported = superjson.parse<typeof range>(superjson.stringify(range))
  assert.equal(transported.startsAt.toISOString(), expectedStart, "The selected instant survives tRPC serialization")
}

const midnight = getCalendarTimeRange("2026-10-20", 5, 30, "Europe/Helsinki")
assert.equal(midnight.startsAt.toISOString(), "2026-10-19T21:05:00.000Z", "Early bookings keep their business date across UTC midnight")

const now = +new Date("2026-10-19T21:43:25Z")
assert.equal(getCalendarEarliestBookingMinute("2026-10-20", "Europe/Helsinki", now), 45, "The next future start follows the business-local date across UTC midnight")
assert.equal(getCalendarEarliestBookingMinute("2026-10-19", "Europe/Helsinki", now), 1440, "Past business dates have no selectable time")
assert.equal(getCalendarEarliestBookingMinute("2026-10-21", "Europe/Helsinki", now), 0, "Future dates allow midnight")
assert.equal(getCalendarEarliestBookingMinute("2026-10-20", "Europe/Helsinki", +new Date("2026-10-19T21:45:00Z")), 60, "A start exactly at the current time is not in the future")

console.info("PASS dragged time normalization, Helsinki daylight saving offsets, duration and tRPC date serialization")
