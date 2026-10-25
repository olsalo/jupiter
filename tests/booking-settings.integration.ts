import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/booking-settings", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const orgIds: string[] = []
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Booking settings test", email: `booking-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const org = await prisma.organization.create({ data: { name: "Booking settings test", slug: `booking-${suffix}`, createdAt: new Date(), settings: { create: { countryCode: "FI" } }, members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  orgIds.push(org.id)
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId: org.id, formatPreference: "eu", formatLocale: "fi-FI", locale: "en" })
  const defaults = await caller.organizations.bookingSettings()
  assert.equal(defaults.bookingEnabled, true)
  assert.equal(defaults.maxBookingAdvanceDays, null)
  const input = { ...defaults, bookingEnabled: false, minBookingNoticeMinutes: 120, maxBookingAdvanceDays: 60, allowCustomerCancellation: false, cancellationNoticeMinutes: 1440, allowCustomerRescheduling: false, rescheduleNoticeMinutes: 120, requireCustomerEmail: false, requireCustomerPhone: true }
  await caller.organizations.updateSettings({ autoConfirmAppointments: false, senderName: "Keep me" })
  assert.deepEqual(await caller.organizations.updateBookingSettings(input), input)
  assert.deepEqual(await caller.organizations.bookingSettings(), input)
  await caller.organizations.updateBookingSettings({ requireCustomerPhone: false })
  assert.deepEqual(await caller.organizations.bookingSettings(), { ...input, requireCustomerPhone: false })
  await caller.organizations.updateBookingSettings({ minBookingNoticeMinutes: 180, maxBookingAdvanceDays: null })
  assert.deepEqual(await caller.organizations.bookingSettings(), { ...input, requireCustomerPhone: false, minBookingNoticeMinutes: 180, maxBookingAdvanceDays: null })
  await caller.organizations.updateBookingSettings(input)
  const settings = (await caller.organizations.getCurrent()).settings!
  assert.equal(settings.autoConfirmAppointments, false)
  assert.equal(settings.senderName, "Keep me")
  const extraFields = { ...input, maxBookingAdvanceDays: null, senderName: "Overwrite", autoConfirmAppointments: true }
  await caller.organizations.updateBookingSettings(extraFields)
  assert.equal((await caller.organizations.bookingSettings()).maxBookingAdvanceDays, null)
  assert.equal((await caller.organizations.getCurrent()).settings!.senderName, "Keep me")
  assert.equal((await caller.organizations.getCurrent()).settings!.autoConfirmAppointments, false)
  for (const invalid of [{ minBookingNoticeMinutes: -1 }, { cancellationNoticeMinutes: 525601 }, { rescheduleNoticeMinutes: 1.5 }, { maxBookingAdvanceDays: 0 }, { maxBookingAdvanceDays: 731 }]) {
    await assert.rejects(caller.organizations.updateBookingSettings({ ...input, ...invalid }), { code: "BAD_REQUEST" })
  }
  const foreign = await prisma.organization.create({ data: { name: "Foreign booking", slug: `foreign-booking-${suffix}`, createdAt: new Date(), settings: { create: { minBookingNoticeMinutes: 999 } } } })
  orgIds.push(foreign.id)
  assert.equal((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: foreign.id } })).minBookingNoticeMinutes, 999)
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "member" } })
  await assert.rejects(caller.organizations.bookingSettings(), { code: "FORBIDDEN" })
  await assert.rejects(caller.organizations.updateBookingSettings(input), { code: "FORBIDDEN" })
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "admin" } })
  await caller.organizations.updateBookingSettings(input)
  await prisma.organizationSettings.delete({ where: { organizationId: org.id } })
  assert.deepEqual(await caller.organizations.bookingSettings(), defaults)
  assert.deepEqual(await caller.organizations.updateBookingSettings(input), input)
  console.info("PASS booking settings defaults, persistence, nullable advance limit, validation, field isolation, missing settings and permissions")
} finally {
  if (orgIds.length) await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
