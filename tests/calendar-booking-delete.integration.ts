import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-booking-delete", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const suffix = randomUUID()
let userId: string | undefined
const organizationIds: string[] = []
try {
  const user = await prisma.user.create({ data: { name: "Deletion test", email: `delete-${suffix}@example.invalid` } })
  userId = user.id
  const organization = await prisma.organization.create({ data: { name: "Deletion test", slug: `delete-${suffix}`, createdAt: new Date(), members: { create: { userId: user.id, role: "member", createdAt: new Date() } } } })
  organizationIds.push(organization.id)
  const other = await prisma.organization.create({ data: { name: "Other deletion test", slug: `other-delete-${suffix}`, createdAt: new Date() } })
  organizationIds.push(other.id)
  const session = await prisma.session.create({ data: { userId: user.id, token: randomUUID(), activeOrganizationId: organization.id, expiresAt: new Date(Date.now() + 86400000) } })
  const context = { headers: new Headers(), request: undefined, prisma, user, session, organizationId: organization.id, formatLocale: "en-GB", formatPreference: "eu" as const, locale: "en" as const }
  const caller = appRouter.createCaller(context)
  const customer = await prisma.customer.create({ data: { organizationId: organization.id, firstName: "Aino" } })
  const service = await prisma.service.create({ data: { organizationId: organization.id, name: "Consultation", slug: "consultation", durationMinutes: 30 } })
  const booking = await prisma.appointment.create({ data: {
    organizationId: organization.id, customerId: customer.id, bookingCode: randomUUID(), status: "CONFIRMED", timezone: "Europe/Helsinki", startsAt: new Date("2030-01-02T09:00:00Z"), endsAt: new Date("2030-01-02T09:30:00Z"),
    services: { create: { serviceId: service.id, name: service.name, durationMinutes: 30 } },
    notifications: { create: { organizationId: organization.id, kind: "REMINDER", channel: "EMAIL", status: "SCHEDULED", recipient: "test@example.invalid", body: "Reminder" } },
  } })
  const anonymous = appRouter.createCaller({ ...context, user: undefined, session: undefined })
  await assert.rejects(anonymous.appointment.delete({ id: booking.id }), { code: "UNAUTHORIZED" })
  await assert.rejects(appRouter.createCaller({ ...context, organizationId: other.id, session: { ...session, activeOrganizationId: other.id } }).appointment.delete({ id: booking.id }), { code: "FORBIDDEN" })
  await prisma.member.create({ data: { organizationId: other.id, userId: user.id, role: "member", createdAt: new Date() } })
  const otherCaller = appRouter.createCaller({ ...context, organizationId: other.id, session: { ...session, activeOrganizationId: other.id } })
  await assert.rejects(otherCaller.appointment.delete({ id: booking.id }), { code: "NOT_FOUND" })
  assert.equal(await prisma.appointment.count({ where: { id: booking.id } }), 1)
  assert.deepEqual(await caller.appointment.delete({ id: booking.id }), { id: booking.id })
  assert.equal(await prisma.appointment.count({ where: { id: booking.id } }), 0)
  assert.equal(await prisma.appointmentService.count({ where: { appointmentId: booking.id } }), 0)
  assert.equal(await prisma.notification.count({ where: { appointmentId: booking.id } }), 0)
  assert.equal(await prisma.customer.count({ where: { id: customer.id } }), 1)
  assert.equal(await prisma.service.count({ where: { id: service.id } }), 1)
  await assert.rejects(caller.appointment.delete({ id: booking.id }), { code: "NOT_FOUND" })
  console.info("PASS booking deletion checks authentication and business access, removes reminders and snapshots, and preserves the customer and service")
} finally {
  try {
    await prisma.appointment.deleteMany({ where: { organizationId: { in: organizationIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
