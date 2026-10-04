import assert from "node:assert/strict"
const { getGreetingPeriod, getOverviewDays, getOverviewRange, getStartOfWeek } = await import(
  new URL("../app/lib/overview-time.ts", import.meta.url).href
) as typeof import("../app/lib/overview-time")

const timeZone = "Europe/Helsinki"
assert.equal(getGreetingPeriod(new Date("2026-10-02T08:59:00Z"), timeZone), "morning")
assert.equal(getGreetingPeriod(new Date("2026-10-02T09:00:00Z"), timeZone), "afternoon")
assert.equal(getGreetingPeriod(new Date("2026-10-02T14:00:00Z"), timeZone), "evening")
assert.equal(getGreetingPeriod(new Date("2026-10-01T21:00:00Z"), timeZone), "morning")
assert.equal(getStartOfWeek(new Date("2026-10-04T20:59:59Z"), timeZone).toISOString(), "2026-09-27T21:00:00.000Z")
assert.equal(getStartOfWeek(new Date("2026-10-04T21:00:00Z"), timeZone).toISOString(), "2026-10-04T21:00:00.000Z")
// The week containing a DST transition starts with the offset from Monday.
assert.equal(getStartOfWeek(new Date("2026-03-29T12:00:00Z"), timeZone).toISOString(), "2026-03-22T22:00:00.000Z")
assert.equal(getStartOfWeek(new Date("2026-10-25T12:00:00Z"), timeZone).toISOString(), "2026-10-18T21:00:00.000Z")
assert.equal(getStartOfWeek(new Date("2026-10-05T02:00:00Z"), "America/New_York").toISOString(), "2026-09-28T04:00:00.000Z")
console.info("PASS greeting periods, Monday boundaries, workspace timezones, and DST transitions")

const springDays = getOverviewDays(new Date("2026-03-30T12:00:00Z"), timeZone)
assert.equal(springDays.length, 30)
assert.equal(springDays[0].key, "2026-03-01")
assert.equal(springDays.at(-1)!.key, "2026-03-30")
assert.equal(springDays.at(-2)!.date, "2026-03-28T22:00:00.000Z")
assert.equal(springDays.at(-1)!.date, "2026-03-29T21:00:00.000Z")
assert.equal(new Set(springDays.map((day) => day.key)).size, 30)
const autumnDays = getOverviewDays(new Date("2026-10-26T12:00:00Z"), timeZone)
assert.equal(autumnDays.at(-2)!.date, "2026-10-24T21:00:00.000Z")
assert.equal(autumnDays.at(-1)!.date, "2026-10-25T22:00:00.000Z")
const newYearDays = getOverviewDays(new Date("2027-01-01T05:00:00Z"), "America/New_York")
assert.equal(newYearDays[0].key, "2026-12-03")
assert.equal(newYearDays.at(-1)!.key, "2027-01-01")
assert.equal(getOverviewDays(new Date("2027-01-01T04:59:59Z"), "America/New_York").at(-1)!.key, "2026-12-31")
console.info("PASS 30 calendar days across DST, year changes, and workspace midnight")

const historicalRange = getOverviewRange(new Date("2026-10-04T12:00:00Z"), timeZone, { days: 2, endDate: "2026-03-30" })
assert.deepEqual(historicalRange.days.map((day) => day.key), ["2026-03-29", "2026-03-30"])
assert.equal(historicalRange.start.toISOString(), "2026-03-28T22:00:00.000Z")
assert.equal(historicalRange.end.toISOString(), "2026-03-30T21:00:00.000Z")
const singleDay = getOverviewRange(new Date("2026-10-04T12:00:00Z"), timeZone, { days: 1, endDate: "2026-10-25" })
assert.equal(singleDay.days.length, 1)
assert.equal(singleDay.end.getTime() - singleDay.start.getTime(), 25 * 60 * 60 * 1000)
assert.equal(getOverviewDays(new Date("2026-10-04T12:00:00Z"), timeZone, { days: 90 }).length, 90)
console.info("PASS configurable and historical date ranges with DST-aware exclusive end boundaries")
