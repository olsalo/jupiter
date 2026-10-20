import assert from "node:assert/strict"
import { createServer } from "vite"

const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
try {
  const { generateSlots, getAvailableSlots, overlaps } = await vite.ssrLoadModule("/app/.server/services/availability.ts") as typeof import("../app/.server/services/availability")
  const { localWindows, localDate, minuteMs } = await vite.ssrLoadModule("/app/.server/services/time.ts") as typeof import("../app/.server/services/time")
  const { assertTransition } = await vite.ssrLoadModule("/app/.server/services/appointments.ts") as typeof import("../app/.server/services/appointments")
  const schemas = await vite.ssrLoadModule("/app/lib/schemas/appointments.ts") as typeof import("../app/lib/schemas/appointments")
  const start = Date.parse("2026-10-12T09:00:00Z")
  const at = (minutes: number) => start + minutes * minuteMs
  const base = { windows: [{ start, end: at(180) }], conflicts: [], from: start, to: at(180), now: at(-1440), duration: 60, before: 0, after: 0, interval: 15, notice: 0, horizon: null }
  assert.equal(generateSlots(base).length, 9)
  const past = { ...base, now: at(1440), notice: 90 }
  assert.deepEqual(generateSlots(past), [], "Public availability excludes past starts")
  assert.deepEqual(generateSlots({ ...past, allowPast: true }), generateSlots(base), "Calendar past slots match future availability")
  assert.deepEqual(generateSlots({ ...past, allowPast: true, conflicts: [{ start: at(60), end: at(120) }] }), [start, at(120)], "Past bookings still respect conflicts")
  assert.deepEqual(generateSlots({ ...past, allowPast: true, before: 15, after: 15 }), generateSlots({ ...base, before: 15, after: 15 }), "Past bookings still respect buffers and working hours")
  assert.equal(generateSlots({ ...base, windows: [{ start: at(3), end: at(180) }], interval: 15, alignToInterval: true })[0], at(15), "Create start options align to the fifteen-minute picker even for irregular working hours")
  assert.deepEqual(generateSlots({ ...base, exactStart: at(5), duration: 45 }), [at(5)], "A manual range can start between public slots")
  assert.deepEqual(generateSlots({ ...base, exactStart: at(150), duration: 45 }), [], "The entire custom length must fit")
  assert.deepEqual(generateSlots({ ...base, exactStart: at(5), duration: 45, conflicts: [{ start: at(40), end: at(60) }] }), [], "Manual selection checks the full duration")
  assert.deepEqual(generateSlots({ ...base, exactStart: at(5), before: 10 }), [], "Manual selection preserves service buffers")
  const offGrid = { ...base, duration: 30, conflicts: [{ start: at(30), end: at(50) }] }
  assert.ok(generateSlots(offGrid).includes(at(50)), "Public availability includes the exact end of a twenty-minute service")
  assert.ok(generateSlots({ ...offGrid, duration: 20 }).includes(at(10)), "Public availability includes a start that ends exactly at the next booking")
  assert.ok(generateSlots({ ...offGrid, before: 5, after: 10 }).includes(at(55)), "Adjacent availability keeps the new service preparation buffer")
  assert.ok(generateSlots({ ...offGrid, before: 5, after: 10 }).includes(at(-10)) === false, "Adjacent starts must fit working hours and buffers")
  assert.ok(!generateSlots({ ...offGrid, notice: 60, now: start }).includes(at(50)), "Adjacent starts still respect booking notice")
  assert.ok(!generateSlots({ ...offGrid, to: at(50) }).includes(at(50)), "Adjacent starts stay inside the requested range")
  assert.deepEqual(generateSlots({ ...offGrid, from: at(50), to: at(50) + 1 }), [at(50)], "Public booking rechecks accept an offered off-grid adjacent start")
  assert.deepEqual(generateSlots({ ...offGrid, exactStart: at(60) }), [at(60)], "Exact-start queries never add adjacent alternatives")
  assert.ok(!generateSlots({ ...offGrid, breakConflicts: [{ start: at(50), end: at(80) }] }).includes(at(50)), "Adjacent starts cannot overlap a break")
  assert.ok(generateSlots({ ...offGrid, breakConflicts: [{ start: at(50), end: at(80) }] }).includes(at(80)), "The end of a break can also close an off-grid gap")
  assert.ok(generateSlots({ ...base, allowBreakOverlapStart: at(5), duration: 30 }).includes(at(5)), "Length edits preserve valid off-grid starts even when no break is present")
  assert.ok(!generateSlots({ ...base, allowBreakOverlapStart: at(5), duration: 30, conflicts: [{ start: at(20), end: at(40) }] }).includes(at(5)), "Exact off-grid starts still check their full duration for conflicts")
  assert.ok(!generateSlots({ ...base, allowBreakOverlapStart: at(5), before: 10 }).includes(at(5)), "Off-grid starts preserve preparation buffers")
  assert.deepEqual(generateSlots({ ...base, exactStart: at(15), allowBreakOverlapStart: at(5) }), [at(15)], "Single-start validation never introduces an alternative requested start")
  let appointmentBuffers: { bufferBeforeMinutes: number; bufferAfterMinutes: number }[] = []
  let allowSimultaneousBookings = false
  let breakEnabled = false
  let ownSchedule: { dayOfWeek: number; startMinute: number; endMinute: number; isActive: boolean } | undefined
  const snapshot = { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }
  const db = {
    organizationSettings: { findUnique: async () => ({ allowSimultaneousBookings, timezone: "UTC" }) },
    appointmentService: { findFirst: async () => ({ id: "saved-service" }) },
    service: { findFirst: async () => ({ id: "service", ...snapshot, maxAttendees: 1, paymentRequirement: "NONE", serviceLocations: [] }) },
    serviceResource: { count: async () => 0 },
    staffMember: { findMany: async () => [{ id: "alice", staffLocations: [] }] },
    availabilityRule: { findMany: async () => [
      { timezone: "UTC", dayOfWeek: 1, startMinute: 540, endMinute: 720, isActive: true, isBreak: false, staffMemberId: null, locationId: null },
      ...(ownSchedule ? [{ timezone: "UTC", isBreak: false, staffMemberId: "alice", locationId: null, ...ownSchedule }] : []),
      ...(breakEnabled ? [{ timezone: "UTC", dayOfWeek: 1, startMinute: 570, endMinute: 600, isActive: true, isBreak: true, staffMemberId: null, locationId: null }] : []),
    ] },
    availabilityOverride: { findMany: async () => [] },
    blockedTime: { findMany: async () => [] },
    appointment: { findMany: async () => [{ staffMemberId: "alice", startsAt: new Date(at(30)), endsAt: new Date(at(60)), services: appointmentBuffers }] },
  } as unknown as Parameters<typeof getAvailableSlots>[0]
  const input = { serviceId: "service", staffMemberId: "alice", from: new Date(start), to: new Date(at(180)) }
  const options = { excludeAppointmentId: "saved-booking", snapshot, purpose: "reschedule" as const, listStarts: true, durationMinutes: 60, now: new Date(at(-1440)) }
  const starts = async () => (await getAvailableSlots(db, "business", input, options)).days.flatMap((day) => day.slots.map((slot) => +new Date(slot.startsAt)))
  const pastOptions = { ...options, now: new Date(at(1440)) }
  assert.equal((await getAvailableSlots(db, "business", input, pastOptions)).days.length, 0, "Public slot queries exclude past dates")
  const pastSlots = (await getAvailableSlots(db, "business", input, { ...pastOptions, allowPast: true })).days.flatMap((day) => day.slots)
  assert.ok(pastSlots.some((slot) => +new Date(slot.startsAt) === at(60)), "Calendar queries include available starts in the past")
  assert.ok(!pastSlots.some((slot) => +new Date(slot.startsAt) === start), "Calendar queries still reject past conflicts")
  assert.equal((await starts()).includes(start), false, "Lengthening a booking checks conflicts throughout its new duration")
  allowSimultaneousBookings = true
  assert.equal((await starts()).includes(start), true, "Lengthening keeps the selected start when simultaneous bookings allow its overlap")
  breakEnabled = true
  assert.equal((await starts()).includes(start), false, "Simultaneous bookings still respect breaks during the full duration")
  breakEnabled = false
  ownSchedule = { dayOfWeek: 1, startMinute: 600, endMinute: 660, isActive: true }
  assert.deepEqual(await starts(), [at(60)], "Member hours replace business hours rather than adding extra suggested times")
  ownSchedule = { ...ownSchedule, isActive: false }
  assert.deepEqual(await starts(), [], "Disabled member hours do not fall back to business hours")
  ownSchedule = { ...ownSchedule, dayOfWeek: 2, isActive: true }
  assert.deepEqual(await starts(), [], "A day off in a member's own schedule stays unavailable")
  ownSchedule = undefined
  assert.ok((await starts()).includes(start), "Members without their own schedule inherit business hours")
  allowSimultaneousBookings = false
  const preferred = await getAvailableSlots(db, "business", input, { ...options, durationMinutes: 20, preferAdjacentStarts: true })
  assert.equal(preferred.days[0].slots[0].startsAt, new Date(at(10)).toISOString(), "Public suggestions prefer an exact fit before the next booking")
  appointmentBuffers = [{ bufferBeforeMinutes: 5, bufferAfterMinutes: 7 }]
  const bufferedSlots = await getAvailableSlots(db, "business", input, { ...options, durationMinutes: 20, snapshot: { durationMinutes: 20, bufferBeforeMinutes: 5, bufferAfterMinutes: 10 } })
  const bufferedStarts = bufferedSlots.days.flatMap((day) => day.slots.map((slot) => +new Date(slot.startsAt)))
  assert.ok(bufferedStarts.includes(at(72)), "Availability includes both bookings' preparation and cleanup buffers at an off-grid edge")
  assert.ok(!bufferedStarts.includes(at(60)), "The visible end of a booking does not erase its cleanup buffer")
  appointmentBuffers = []
  assert.deepEqual(generateSlots({ ...base, windows: [] }), [])
  assert.equal(generateSlots({ ...base, windows: [...base.windows, { start: at(240), end: at(360) }], to: at(360) }).length, 14)
  assert.equal(generateSlots({ ...base, windows: [...base.windows, ...base.windows] }).length, 9)
  assert.deepEqual(generateSlots({ ...base, conflicts: [{ start: at(60), end: at(120) }] }), [start, at(120)])
  assert.deepEqual(generateSlots({ ...base, before: 15, conflicts: [{ start: at(60), end: at(120) }] }), [])
  assert.deepEqual(generateSlots({ ...base, after: 15, conflicts: [{ start: at(60), end: at(120) }] }), [])
  assert.deepEqual(generateSlots({ ...base, interval: 60 }), [start, at(60), at(120)])
  assert.deepEqual(generateSlots({ ...base, now: start, notice: 90 }), [at(90), at(105), at(120)])
  assert.deepEqual(generateSlots({ ...base, now: at(-1440), horizon: 1 }), [start])
  assert.deepEqual(generateSlots({ ...base, conflicts: [{ start: at(-30), end: at(240) }] }), [])
  assert.equal(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 }), false)
  assert.equal(overlaps({ start: 0, end: 10 }, { start: 9, end: 20 }), true)
  assert.equal(generateSlots({ ...base, from: at(30), to: at(31) })[0], at(30))
  assert.equal(generateSlots({ ...base, before: 15 }).at(0), at(15))
  assert.equal(generateSlots({ ...base, after: 15 }).at(-1), at(105))
  // Helsinki jumps from 03:00 to 04:00 on March 29, then repeats 03:00 in October
  const spring = localWindows(new Date("2026-03-29T00:00Z"), new Date("2026-03-30T00:00Z"), "Europe/Helsinki", 0, 120, 300)
  assert.equal(spring[0].end - spring[0].start, 2 * 3600000)
  const autumn = localWindows(new Date("2026-10-25T00:00Z"), new Date("2026-10-26T00:00Z"), "Europe/Helsinki", 0, 120, 300)
  assert.equal(autumn[0].end - autumn[0].start, 4 * 3600000)
  const missing = localWindows(new Date("2026-03-29T00:00Z"), new Date("2026-03-30T00:00Z"), "Europe/Helsinki", 0, 210, 300)
  assert.equal(missing.length, 1)
  assert.equal(missing[0].end - missing[0].start, 3600000)
  const repeated = localWindows(new Date("2026-10-25T00:00Z"), new Date("2026-10-26T00:00Z"), "Europe/Helsinki", 0, 210, 240)
  assert.equal(repeated.length, 2)
  assert.equal(repeated.reduce((sum, window) => sum + window.end - window.start, 0), 3600000)
  assert.equal(localDate(new Date("2026-10-12T22:30Z"), "Europe/Helsinki"), "2026-10-13")
  assertTransition("PENDING", "CONFIRMED")
  assertTransition("CHECKED_IN", "IN_PROGRESS")
  assert.throws(() => assertTransition("CANCELLED", "CONFIRMED"))
  assert.throws(() => assertTransition("PENDING", "COMPLETED"))
  assert.equal(schemas.publicSlotInput.safeParse({ organizationSlug: "test", serviceId: "x", from: "2026-01-01", to: "2026-03-01" }).success, false)
  assert.equal(schemas.ruleInput.safeParse({ timezone: "Europe/Helsinki", dayOfWeek: 1, startMinute: 600, endMinute: 500 }).success, false)
  assert.equal(schemas.timezone.safeParse("Not/AZone").success, false)
  assert.equal(schemas.overrideInput.safeParse({ startsAt: "2026-01-01", endsAt: "2025-01-01", isAvailable: true }).success, false)
  assert.equal(schemas.serviceUpdateInput.parse({ id: "test", name: "Updated" }).price, undefined)
  assert.equal(schemas.bookingDuration.safeParse(10).success, false, "Booking durations below fifteen minutes are rejected")
  assert.equal(schemas.bookingDuration.safeParse(15).success, true, "Fifteen-minute bookings are accepted")
  console.info("PASS availability windows, conflicts, buffers, interval, notice, horizon, DST, transitions and input validation")
} finally {
  await vite.close()
}
