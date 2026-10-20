import assert from "node:assert/strict"
import { getBookingAvailabilityIssues } from "../app/lib/calendar/booking-issues.ts"

const from = Date.parse("2030-04-01T10:00:00Z")
const booking = { startsAt: new Date(from), endsAt: new Date(from + 3600000), status: "CONFIRMED", now: from - 86400000 }
const window = (start: number, end: number) => ({ start: from + start * 60000, end: from + end * 60000 })
const check = (workingWindows = [window(-60, 120)], breakWindows: ReturnType<typeof window>[] = []) => getBookingAvailabilityIssues({ ...booking, workingWindows, breakWindows })
assert.deepEqual(check(), [])
assert.deepEqual(check([window(15, 120)]), ["outsideWorkingHours"], "Partial coverage at the start is an issue")
assert.deepEqual(check([window(-60, 45)]), ["outsideWorkingHours"], "Partial coverage at the end is an issue")
assert.deepEqual(check([window(-60, 20), window(30, 120)]), ["outsideWorkingHours"], "A gap inside the booking is an issue")
assert.deepEqual(check([window(-60, 30), window(30, 120)]), [], "Touching working periods cover the whole booking")
assert.deepEqual(check([], [window(15, 30)]), ["outsideWorkingHours", "overlapsBreak"], "All issues are reported")
assert.deepEqual(check(undefined, [window(-30, 0), window(60, 90)]), [], "Touching a break's boundary does not overlap")
assert.deepEqual(check(undefined, [window(59, 90)]), ["overlapsBreak"])
assert.deepEqual(getBookingAvailabilityIssues({ ...booking, now: from, workingWindows: [], breakWindows: [window(0, 60)] }), [], "Past and ongoing bookings are not flagged")
for (const status of ["CANCELLED", "COMPLETED", "NO_SHOW"]) assert.deepEqual(getBookingAvailabilityIssues({ ...booking, status, workingWindows: [], breakWindows: [window(0, 60)] }), [])
console.log("Calendar booking availability issue checks passed")
