import assert from "node:assert/strict"

import { getCalendarBookingDurationLimit } from "../app/lib/calendar/booking-duration.ts"

const startsAt = new Date("2026-10-14T09:00:00Z")
const booking = { id: "other", startsAt: "2026-10-14T10:10:00Z", endsAt: "2026-10-14T11:00:00Z", status: "CONFIRMED", staffMember: { id: "alice" } }
const limit = (bookings: typeof booking[], appointmentId?: string) => getCalendarBookingDurationLimit(bookings, startsAt, "alice", appointmentId)
assert.equal(limit([booking]), 70, "A duration may end exactly when the next booking starts")
assert.equal(limit([booking, { ...booking, id: "closer", startsAt: "2026-10-14T09:45:00Z" }]), 45, "The nearest booking sets the maximum")
assert.equal(limit([booking], booking.id), 1440, "Editing excludes the booking itself")
assert.equal(limit([{ ...booking, staffMember: { id: "bob" } }]), 1440, "Other members do not constrain the duration")
assert.equal(limit([{ ...booking, status: "CANCELLED" }]), 1440)
assert.equal(limit([{ ...booking, startsAt: "2026-10-14T08:00:00Z", endsAt: "2026-10-14T09:00:00Z" }]), 1440, "An earlier booking may touch the selected start")
assert.equal(limit([{ ...booking, startsAt: "2026-10-14T08:00:00Z", endsAt: "2026-10-14T09:15:00Z" }]), 0, "An existing overlap cannot be extended")
assert.equal(limit([{ ...booking, startsAt: "2026-10-15T00:15:00Z", endsAt: "2026-10-15T01:00:00Z" }]), 915, "Long durations also check bookings on the next day")
assert.equal(limit([]), 1440)
assert.equal(limit([{ ...booking, status: "COMPLETED" }]), 70, "Completed bookings still reserve past time")
const buffered = { ...booking, services: [{ bufferBeforeMinutes: 10, bufferAfterMinutes: 15 }] }
assert.equal(getCalendarBookingDurationLimit([buffered], startsAt, "alice"), 60, "The next booking's preparation buffer limits the duration")
assert.equal(getCalendarBookingDurationLimit([buffered], startsAt, "alice", undefined, { afterMinutes: 5 }), 55, "The new booking's cleanup buffer also needs room")
const previous = { ...buffered, startsAt: "2026-10-14T08:00:00Z", endsAt: "2026-10-14T08:50:00Z", status: "COMPLETED" }
assert.equal(getCalendarBookingDurationLimit([previous], startsAt, "alice"), 0, "A completed booking's cleanup buffer blocks a later start")
assert.equal(getCalendarBookingDurationLimit([{ ...previous, endsAt: "2026-10-14T08:40:00Z" }], startsAt, "alice", undefined, { beforeMinutes: 10 }), 0, "Preparation cannot overlap an earlier cleanup buffer")
console.info("PASS duration limits, touching bookings, self exclusion, members, statuses, existing overlaps and midnight")
