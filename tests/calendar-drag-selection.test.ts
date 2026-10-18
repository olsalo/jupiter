import assert from "node:assert/strict"
import superjson from "superjson"

import { getCalendarTimeRange } from "../app/lib/calendar-date.ts"

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

console.info("PASS dragged time normalization, Helsinki daylight saving offsets, duration and tRPC date serialization")
