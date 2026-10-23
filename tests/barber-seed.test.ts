import assert from "node:assert/strict"
import { Temporal } from "@js-temporal/polyfill"
import type { PrismaClient } from "../generated/prisma/client.ts"
import { barberSeedOptions, seedBarberShop } from "../scripts/lib/barber-seed.ts"
import { businessHolidayWindows } from "../app/lib/business-holidays.ts"

// Capture the proposed dataset so scheduling and relationship checks need no remote database.
type Row = Record<string, any>
const rows = new Map<string, Row[]>()
const table = (model: string) => {
  if (!rows.has(model)) rows.set(model, [])
  return rows.get(model)!
}
const db = new Proxy({}, {
  get(_target, model: string) {
    if (model === "$transaction") return (run: (tx: unknown) => Promise<unknown>) => run(db)
    if (model === "$executeRaw") return async () => 1
    return {
      create: async ({ data }: { data: Row }) => { table(model).push(data); return data },
      createMany: async ({ data }: { data: Row[] }) => { table(model).push(...data); return { count: data.length } },
      upsert: async ({ where, create }: { where: Row, create: Row }) => {
        const found = table(model).find((row) => row.email === where.email)
        if (found) return found
        table(model).push(create)
        return create
      },
      findUnique: async ({ where }: { where: Row }) => {
        const found = table(model).find((row) => row.slug === where.slug)
        return found ? { ...found, members: table("member").filter((member) => member.organizationId === found.id && member.role === "owner").map((member) => ({ ...member, user: table("user").find((user) => user.id === member.userId) })) } : null
      },
    }
  },
}) as PrismaClient

assert.equal(barberSeedOptions.safeParse({ ownerName: " ", ownerEmail: "invalid" }).success, false)
const now = new Date("2026-10-22T10:00:00Z")
const options = { ownerName: "John Smith", ownerEmail: " JOHN@EXAMPLE.COM " }
table("user").push({ id: "existing-owner", name: "Existing Owner", email: "john@example.com", locale: "fi" })
const result = await seedBarberShop(db, options, now)
assert.equal(result.created, true)
assert.equal(table("user")[0].name, "Existing Owner")
assert.equal(table("user")[0].locale, "fi")
assert.equal(table("member").find((row) => row.role === "owner")?.userId, "existing-owner")
assert.equal(table("staffMember")[0].name, "John Smith")
assert.equal(table("staffMember").length, 6)
assert.equal(table("customer").length, 360)
const ownerStaffId = table("staffMember")[0].id
assert.equal(table("staffMember")[0].acceptsAppointments, false)
assert.equal(table("staffService").some((row) => row.staffMemberId === ownerStaffId), false)
assert.equal(table("bookingPageStaff").some((row) => row.staffMemberId === ownerStaffId), false)
assert.equal(table("availabilityRule").some((row) => row.staffMemberId === ownerStaffId), false)
assert.equal(table("service").length, 8)
assert.equal(table("notification").length, 0)
assert.equal(table("organizationSettings")[0].enableAppointmentReminders, false)
assert.equal(table("organizationSettings")[0].sendBookingConfirmations, false)

for (const [model, field, parent] of [
  ["staffService", "serviceId", "service"], ["staffService", "staffMemberId", "staffMember"],
  ["appointment", "customerId", "customer"], ["appointment", "staffMemberId", "staffMember"],
  ["appointmentService", "appointmentId", "appointment"], ["appointmentService", "serviceId", "service"],
  ["payment", "appointmentId", "appointment"], ["bookingPageService", "serviceId", "service"],
  ["bookingPageStaff", "staffMemberId", "staffMember"],
]) {
  const ids = new Set(table(parent).map((row) => row.id))
  for (const row of table(model)) assert.ok(ids.has(row[field]), `${model}.${field} must point to ${parent}`)
}

const offsets = new Set<string>()
const endByStaff = new Map<string, number>()
const appointments = [...table("appointment")].sort((a, b) => +a.startsAt - +b.startsAt)
assert.ok(appointments.length > 300)
assert.ok(appointments.some((row) => Temporal.Instant.fromEpochMilliseconds(+row.startsAt).toZonedDateTimeISO("Europe/Helsinki").hour >= 16), "Appointments should include late-afternoon visits")
function verifyAvailability(organizationId: string) {
  const settings = table("organizationSettings").find((row) => row.organizationId === organizationId)!
  const rules = table("availabilityRule").filter((row) => row.organizationId === organizationId)
  const bookings = table("appointment").filter((row) => row.organizationId === organizationId)
  const holidayWindows = businessHolidayWindows(settings.businessHolidays, bookings[0].startsAt, bookings[bookings.length - 1].endsAt, settings.timezone)
  const breakLengths = new Set(rules.filter((rule) => rule.isBreak).map((rule) => rule.endMinute - rule.startMinute))
  assert.deepEqual([...breakLengths].sort((a, b) => a - b), [10, 15, 20, 30, 45])
  const breakCounts = new Set(rules.filter((rule) => rule.staffMemberId && !rule.isBreak).map((shift) => rules.filter((rule) => rule.staffMemberId === shift.staffMemberId && rule.dayOfWeek === shift.dayOfWeek && rule.isBreak).length))
  assert.deepEqual([...breakCounts].sort(), [0, 1, 2, 3])
  const visits = new Map<string, Temporal.PlainDate>()
  for (const appointment of bookings) {
    assert.notEqual(appointment.staffMemberId, ownerStaffId)
    const local = Temporal.Instant.fromEpochMilliseconds(+appointment.startsAt).toZonedDateTimeISO(settings.timezone)
    const snapshot = table("appointmentService").find((row) => row.appointmentId === appointment.id)!
    const startMinute = local.hour * 60 + local.minute
    const endMinute = startMinute + snapshot.durationMinutes + snapshot.bufferAfterMinutes
    const hours = rules.find((rule) => !rule.staffMemberId && rule.dayOfWeek === local.dayOfWeek)
    const shift = rules.find((rule) => rule.staffMemberId === appointment.staffMemberId && rule.dayOfWeek === local.dayOfWeek && !rule.isBreak)
    assert.ok(hours && shift, "Bookings require an open business and a working barber")
    assert.ok(startMinute >= Math.max(hours.startMinute, shift.startMinute))
    assert.ok(endMinute <= Math.min(hours.endMinute, shift.endMinute), "Cleanup must finish before closing")
    assert.equal(rules.some((rule) => rule.staffMemberId === appointment.staffMemberId && rule.dayOfWeek === local.dayOfWeek && rule.isBreak && startMinute < rule.endMinute && endMinute > rule.startMinute), false)
    assert.equal(holidayWindows.some((window) => !window.isOpen && +appointment.startsAt < window.end && +appointment.endsAt + snapshot.bufferAfterMinutes * 60_000 > window.start), false)
    if (appointment.status !== "CANCELLED") {
      const previous = visits.get(appointment.customerId)
      if (previous) assert.ok(previous.until(local.toPlainDate()).days >= 21)
      visits.set(appointment.customerId, local.toPlainDate())
    }
  }
}
verifyAvailability(result.organizationId)
assert.equal(appointments.some((appointment) => Temporal.Instant.fromEpochMilliseconds(+appointment.startsAt).toZonedDateTimeISO("Europe/Helsinki").toPlainDate().toString() === "2026-10-31"), false)
for (const appointment of appointments) {
  const local = Temporal.Instant.fromEpochMilliseconds(+appointment.startsAt).toZonedDateTimeISO("Europe/Helsinki")
  offsets.add(local.offset)
  const snapshot = table("appointmentService").find((row) => row.appointmentId === appointment.id)!
  assert.notEqual(local.dayOfWeek, 7)
  assert.ok(local.hour >= 9)
  assert.ok(appointment.createdAt <= now)
  assert.ok(!appointment.cancelledAt || appointment.cancelledAt <= now)
  assert.equal(+appointment.endsAt - +appointment.startsAt, snapshot.durationMinutes * 60_000)
  assert.equal(appointment.totalAmount, snapshot.totalPrice)
  const payment = table("payment").find((row) => row.appointmentId === appointment.id)
  assert.equal(Boolean(payment), appointment.status === "COMPLETED")
  if (payment) assert.equal(payment.amount, appointment.paidAmount)
  if (!["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
    assert.ok(+appointment.startsAt >= (endByStaff.get(appointment.staffMemberId) ?? 0))
    endByStaff.set(appointment.staffMemberId, +appointment.endsAt + snapshot.bufferAfterMinutes * 60_000)
  }
}
assert.deepEqual([...offsets].sort(), ["+02:00", "+03:00"])
for (const status of ["CANCELLED", "COMPLETED", "CONFIRMED", "NO_SHOW", "PENDING"]) assert.ok(appointments.some((row) => row.status === status))
table("service")[0].name = "Edited Service"
const beforeRepeat = JSON.stringify([...rows])
assert.equal((await seedBarberShop(db, options, now)).created, false)
assert.equal(JSON.stringify([...rows]), beforeRepeat)
const second = await seedBarberShop(db, { ownerName: "Jane Wilson", ownerEmail: "jane@example.com" }, now)
assert.notEqual(second.organizationId, result.organizationId)
assert.equal(table("user").find((row) => row.email === "jane@example.com")?.name, "Jane Wilson")
assert.equal(table("user").find((row) => row.email === "jane@example.com")?.locale, "en")
for (const [index, date] of ["2026-01-02", "2026-04-08", "2026-06-22", "2026-12-28"].entries()) {
  const seasonal = await seedBarberShop(db, { ownerName: "Seasonal Owner", ownerEmail: `season-${index}@example.invalid` }, new Date(`${date}T10:00:00Z`))
  verifyAvailability(seasonal.organizationId)
  const dates = new Set(table("appointment").filter((row) => row.organizationId === seasonal.organizationId).map((row) => Temporal.Instant.fromEpochMilliseconds(+row.startsAt).toZonedDateTimeISO("Europe/Helsinki").toPlainDate().toString()))
  for (const closed of ["2026-01-01", "2026-01-06", "2026-04-03", "2026-04-06", "2026-06-19", "2026-06-20", "2026-12-24", "2026-12-25", "2026-12-26", "2027-01-01", "2027-01-06"]) assert.equal(dates.has(closed), false)
}
console.info("PASS barber dataset: non-bookable owner, six members, varied breaks, shifts, holiday closures across seasons/year boundaries, repeat visits, DST and payments")
