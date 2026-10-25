import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
process.env.STRIPE_SECRET_KEY = ""
process.env.BETTER_AUTH_URL = "http://localhost:5175"
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/schema-integrity", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { getAvailableSlots } = await vite.ssrLoadModule("/app/.server/services/availability.ts") as typeof import("../app/.server/services/availability")
const orgIds: string[] = []
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Schema test", email: `schema-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const org = await prisma.organization.create({ data: { name: "Schema A", slug: `schema-a-${suffix}`, createdAt: new Date(), settings: { create: { timezone: "UTC", minBookingNoticeMinutes: 120 } }, members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  const foreign = await prisma.organization.create({ data: { name: "Schema B", slug: `schema-b-${suffix}`, createdAt: new Date() } })
  orgIds.push(org.id, foreign.id)
  const session = await prisma.session.create({ data: { userId, token: randomUUID(), activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 86400000) } })
  const context = { headers: new Headers(), request: undefined, prisma, user, session, organizationId: org.id, formatPreference: "eu" as const, formatLocale: "fi-FI", locale: "en" as const }
  const caller = appRouter.createCaller(context)
  const anonymous = appRouter.createCaller({ ...context, user: undefined, session: undefined, organizationId: null })
  const customer = await prisma.customer.create({ data: { organizationId: org.id, firstName: "Customer", dateOfBirth: new Date("1990-04-05T00:00Z") } })
  const foreignCustomer = await prisma.customer.create({ data: { organizationId: foreign.id, firstName: "Foreign" } })
  const location = await prisma.location.create({ data: { organizationId: org.id, name: "Office" } })
  const foreignLocation = await prisma.location.create({ data: { organizationId: foreign.id, name: "Foreign office" } })
  const service = await caller.service.create({ name: "Online", durationMinutes: 30, deliveryType: "ONLINE", minBookingNoticeMinutes: 0, cancellationNoticeMinutes: 60, rescheduleNoticeMinutes: 90 })
  const staff = await caller.staff.create({ name: "Staff", serviceIds: [service.id] })
  const foreignService = await prisma.service.create({ data: { organizationId: foreign.id, name: "Foreign", slug: "foreign", durationMinutes: 30 } })
  const foreignTag = await prisma.customerTag.create({ data: { organizationId: foreign.id, name: "Foreign tag" } })
  const startsAt = new Date(Date.now() + 7 * 86400000)
  startsAt.setUTCHours(10, 0, 0, 0)
  const endsAt = new Date(+startsAt + 1800000)
  const input = { organizationId: org.id, customerId: customer.id, bookingCode: randomUUID(), startsAt, endsAt, timezone: "UTC" }
  await assert.rejects(prisma.appointment.create({ data: { ...input, customerId: foreignCustomer.id } }))
  await assert.rejects(prisma.appointment.create({ data: { ...input, locationId: foreignLocation.id } }))
  await assert.rejects(prisma.staffService.create({ data: { staffMemberId: staff.id, serviceId: foreignService.id } }))
  await assert.rejects(prisma.customerTagAssignment.create({ data: { customerId: customer.id, tagId: foreignTag.id } }))
  await assert.rejects(prisma.organizationSettings.update({ where: { organizationId: org.id }, data: { defaultLocationId: foreignLocation.id } }))
  await assert.rejects(prisma.customer.update({ where: { id: customer.id }, data: { organizationId: foreign.id } }))
  const parent = await prisma.appointment.create({ data: input })
  await assert.rejects(prisma.$executeRawUnsafe('UPDATE appointment SET "locationId" = $1 WHERE id = $2', foreignLocation.id, parent.id), { code: "P2010" })
  await assert.rejects(prisma.$executeRawUnsafe('UPDATE service SET "durationMinutes" = 0 WHERE id = $1', service.id), { code: "P2010" })
  await assert.rejects(prisma.appointmentService.create({ data: { appointmentId: parent.id, serviceId: foreignService.id, name: "Wrong", durationMinutes: 30 } }))
  await assert.rejects(prisma.appointment.update({ where: { id: parent.id }, data: { endsAt: startsAt } }))
  await assert.rejects(prisma.appointment.update({ where: { id: parent.id }, data: { cancellationNoticeMinutes: -1 } }))
  await assert.rejects(prisma.service.update({ where: { id: service.id }, data: { durationMinutes: 0 } }))
  await assert.rejects(prisma.service.update({ where: { id: service.id }, data: { bufferAfterMinutes: -1 } }))
  await assert.rejects(prisma.availabilityRule.create({ data: { organizationId: org.id, dayOfWeek: 7, startMinute: 540, endMinute: 1020, timezone: "UTC" } }))
  await assert.rejects(prisma.availabilityRule.create({ data: { organizationId: org.id, dayOfWeek: 1, startMinute: 600, endMinute: 540, timezone: "UTC" } }))
  await assert.rejects(prisma.blockedTime.create({ data: { organizationId: org.id, startsAt: endsAt, endsAt: startsAt } }))
  await prisma.appointment.delete({ where: { id: parent.id } })
  await prisma.location.delete({ where: { id: location.id } })

  const from = new Date(startsAt)
  from.setUTCHours(0, 0, 0, 0)
  const to = new Date(+from + 86400000)
  await caller.availability.replaceRules({ staffMemberId: staff.id, rules: [{ dayOfWeek: from.getUTCDay(), startMinute: 540, endMinute: 1020, timezone: "UTC" }] })
  const range = { serviceId: service.id, from, to }
  const now = new Date(+from + 9 * 3600000)
  const firstSlot = async () => (await getAvailableSlots(prisma, org.id, range, { now })).days[0].slots[0].startsAt
  assert.equal(await firstSlot(), now.toISOString(), "Explicit zero overrides business advance notice")
  await caller.service.update({ id: service.id, minBookingNoticeMinutes: null })
  assert.equal(await firstSlot(), new Date(+now + 120 * 60000).toISOString(), "Null inherits business advance notice")
  await caller.service.update({ id: service.id, minBookingNoticeMinutes: 0 })
  const question = await prisma.bookingQuestion.create({ data: { organizationId: org.id, serviceId: service.id, label: "Original question", type: "BOOLEAN", required: true, sortOrder: 2 } })
  const booking = await anonymous.booking.create({ organizationSlug: org.slug, serviceId: service.id, staffMemberId: staff.id, startsAt, customer: { firstName: "Guest", email: `guest-${suffix}@example.invalid` }, answers: [{ questionId: question.id, value: false }] })
  const appointment = await prisma.appointment.findUniqueOrThrow({ where: { bookingCode: booking.bookingCode } })
  await caller.organizations.updateSettings({ cancellationNoticeMinutes: 50000, rescheduleNoticeMinutes: 50000, allowCustomerCancellation: false, allowCustomerRescheduling: false, maxBookingAdvanceDays: 1 })
  await caller.service.update({ id: service.id, cancellationNoticeMinutes: 50000, rescheduleNoticeMinutes: 50000, maxBookingAdvanceDays: 1 })
  await prisma.bookingQuestion.update({ where: { id: question.id }, data: { label: "Edited question", type: "SHORT_TEXT", sortOrder: 99 } })
  const management = await anonymous.booking.getManagementPage({ bookingCode: booking.bookingCode })
  assert.equal(+management.cancellationDeadline, +startsAt - 60 * 60000)
  assert.equal(+management.deadline, +startsAt - 90 * 60000)
  assert.equal(management.canCancel, true)
  assert.equal(management.canReschedule, true)
  assert.equal(management.maxBookingAdvanceDays, 730, "Captured unlimited advance does not inherit later restrictions")
  const detail = await caller.appointment.get({ id: appointment.id })
  assert.equal(detail.answers[0].question.label, "Original question")
  assert.equal(detail.answers[0].question.sortOrder, 2)
  assert.equal(detail.answers[0].type, "BOOLEAN")
  assert.equal(detail.answers[0].value, false)
  const newStart = new Date(+startsAt + 3600000)
  assert.ok((await caller.appointment.getSlots({ id: appointment.id, from, to })).days.flatMap((day) => day.slots).some((slot) => slot.startsAt === newStart.toISOString()), "Admin suggestions use the same captured limits as booking mutations")
  assert.ok((await anonymous.booking.getRescheduleSlots({ bookingCode: booking.bookingCode, from, to })).days.flatMap((day) => day.slots).some((slot) => slot.startsAt === newStart.toISOString()))
  await anonymous.booking.reschedule({ bookingCode: booking.bookingCode, startsAt: newStart })
  const rescheduleEmail = await prisma.notification.findFirstOrThrow({ where: { appointmentId: appointment.id, kind: "RESCHEDULE" } })
  assert.ok(rescheduleEmail.body.includes(`/booking/${booking.bookingCode}/reschedule`), "Emails retain the captured rescheduling permission")
  await anonymous.booking.cancel({ bookingCode: booking.bookingCode })
  assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).dateOfBirth!.toISOString(), "1990-04-05T00:00:00.000Z")
  console.info("PASS database tenant boundaries, immutable ownership, scheduling CHECKs, date-only birthdays, explicit-zero/inherited notice, immutable policy and question snapshots, rescheduling and cancellation")
} finally {
  try {
    await prisma.appointment.deleteMany({ where: { organizationId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
