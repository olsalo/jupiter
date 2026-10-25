import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { PrismaPg } from "@prisma/adapter-pg"
import { Temporal } from "@js-temporal/polyfill"
import { PrismaClient } from "../generated/prisma/client.ts"
import { barberSeedOptions, seedBarberShop } from "../scripts/lib/barber-seed.ts"
import { generateId } from "../app/lib/database/id.ts"
import { businessHolidayWindows } from "../app/lib/business/business-holidays.ts"

assert.equal(barberSeedOptions.safeParse({ ownerName: " ", ownerEmail: "invalid" }).success, false)
const suffix = randomUUID()
const ownerEmail = `barber-seed-${suffix}@example.invalid`
const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) })
let organizationId: string | undefined
const owner = await db.user.create({ data: { id: generateId(), email: ownerEmail, name: "Existing Owner", locale: "fi" } })
try {
  // The date range crosses the autumn DST transition in Helsinki.
  const now = new Date("2026-10-22T10:00:00Z")
  const result = await seedBarberShop(db, { ownerName: "John Smith", ownerEmail: ` ${ownerEmail.toUpperCase()} ` }, now)
  organizationId = result.organizationId
  assert.equal(result.created, true)
  assert.equal(await db.member.count({ where: { organizationId } }), 6)
  assert.equal(await db.staffMember.count({ where: { organizationId, memberId: { not: null } } }), 6)
  const ownerStaff = await db.staffMember.findFirstOrThrow({ where: { organizationId, member: { userId: owner.id } } })
  assert.equal(ownerStaff.acceptsAppointments, false)
  assert.equal(await db.appointment.count({ where: { staffMemberId: ownerStaff.id } }), 0)
  assert.equal(await db.bookingPageStaff.count({ where: { staffMemberId: ownerStaff.id } }), 0)
  assert.equal(await db.service.count({ where: { organizationId } }), 8)
  assert.equal(await db.customer.count({ where: { organizationId } }), 360)
  assert.equal(await db.staffService.count({ where: { staffMember: { organizationId } } }), 40)
  assert.equal(await db.bookingPageService.count({ where: { bookingPage: { organizationId } } }), 8)
  assert.equal(await db.notification.count({ where: { organizationId } }), 0)
  const settings = await db.organizationSettings.findUniqueOrThrow({ where: { organizationId } })
  assert.equal(settings.onboardingStep, null)
  assert.equal(settings.enableAppointmentReminders, false)
  assert.equal(settings.sendBookingConfirmations, false)
  assert.ok(settings.defaultLocationId)
  assert.ok(settings.defaultBookingPageId)
  const preserved = await db.user.findUniqueOrThrow({ where: { id: owner.id } })
  assert.equal(preserved.name, "Existing Owner")
  assert.equal(preserved.locale, "fi")
  assert.equal(preserved.emailVerified, false)
  assert.equal((await db.member.findUniqueOrThrow({ where: { organizationId_userId: { organizationId, userId: owner.id } } })).role, "owner")

  const appointments = await db.appointment.findMany({ where: { organizationId }, include: { services: true, payments: true }, orderBy: { startsAt: "asc" } })
  assert.ok(appointments.length > 300)
  const statuses = new Set(appointments.map((appointment) => appointment.status))
  for (const status of ["COMPLETED", "CONFIRMED", "PENDING", "CANCELLED", "NO_SHOW"] as const) assert.ok(statuses.has(status))
  assert.ok(appointments.some((appointment) => appointment.startsAt > now))
  assert.ok(appointments.some((appointment) => appointment.endsAt < now))
  const offsets = new Set<string>()
  const staffEnd = new Map<string, number>()
  const rules = await db.availabilityRule.findMany({ where: { organizationId } })
  const holidayWindows = businessHolidayWindows(settings.businessHolidays, appointments[0].startsAt, appointments[appointments.length - 1].endsAt, settings.timezone)
  for (const appointment of appointments) {
    const local = Temporal.Instant.fromEpochMilliseconds(+appointment.startsAt).toZonedDateTimeISO("Europe/Helsinki")
    offsets.add(local.offset)
    assert.notEqual(local.dayOfWeek, 7)
    assert.ok(local.hour >= 9)
    assert.ok(appointment.createdAt <= now)
    assert.ok(!appointment.cancelledAt || appointment.cancelledAt <= now)
    const snapshot = appointment.services[0]
    const startMinute = local.hour * 60 + local.minute
    const endMinute = startMinute + snapshot.durationMinutes + snapshot.bufferAfterMinutes
    const business = rules.find((rule) => !rule.staffMemberId && rule.dayOfWeek === local.dayOfWeek)!
    const shift = rules.find((rule) => rule.staffMemberId === appointment.staffMemberId && rule.dayOfWeek === local.dayOfWeek && !rule.isBreak)!
    assert.ok(business && shift)
    assert.ok(startMinute >= Math.max(business.startMinute, shift.startMinute))
    assert.ok(endMinute <= Math.min(business.endMinute, shift.endMinute))
    assert.equal(rules.some((rule) => rule.staffMemberId === appointment.staffMemberId && rule.dayOfWeek === local.dayOfWeek && rule.isBreak && startMinute < rule.endMinute && endMinute > rule.startMinute), false)
    assert.equal(holidayWindows.some((window) => !window.isOpen && +appointment.startsAt < window.end && +appointment.endsAt + snapshot.bufferAfterMinutes * 60_000 > window.start), false)
    assert.equal(+appointment.endsAt - +appointment.startsAt, snapshot.durationMinutes * 60_000)
    assert.equal(Number(appointment.totalAmount), Number(snapshot.totalPrice))
    if (appointment.status === "COMPLETED") {
      assert.equal(Number(appointment.paidAmount), Number(appointment.totalAmount))
      assert.equal(Number(appointment.payments[0].amount), Number(appointment.totalAmount))
    } else {
      assert.equal(appointment.payments.length, 0)
    }
    if (appointment.status !== "CANCELLED" && appointment.status !== "NO_SHOW") {
      assert.ok(+appointment.startsAt >= (staffEnd.get(appointment.staffMemberId!) ?? 0))
      staffEnd.set(appointment.staffMemberId!, +appointment.endsAt + snapshot.bufferAfterMinutes * 60_000)
    }
  }
  assert.deepEqual([...offsets].sort(), ["+02:00", "+03:00"])
  await db.service.update({ where: { id: appointments[0].services[0].serviceId }, data: { name: "Edited Service" } })
  const repeated = await seedBarberShop(db, { ownerName: "Different Name", ownerEmail }, now)
  assert.equal(repeated.created, false)
  assert.equal(repeated.organizationId, organizationId)
  assert.equal(await db.appointment.count({ where: { organizationId } }), appointments.length)
  assert.equal(await db.service.count({ where: { organizationId, name: "Edited Service" } }), 1)
  console.info("PASS barber seed: owner reuse, linked demo data, repeat runs, scheduling, DST, payments and disabled emails")
} finally {
  // Also find the business if a failing call committed before the assertion.
  const organizations = await db.organization.findMany({ where: { members: { some: { userId: owner.id } }, metadata: "jupiter-barber-v1" } })
  for (const organization of organizations) {
    const users = await db.member.findMany({ where: { organizationId: organization.id }, select: { userId: true } })
    await db.appointment.deleteMany({ where: { organizationId: organization.id } })
    await db.organization.delete({ where: { id: organization.id } })
    await db.user.deleteMany({ where: { id: { in: users.map((member) => member.userId).filter((id) => id !== owner.id) } } })
  }
  await db.user.delete({ where: { id: owner.id } })
  await db.$disconnect()
}
