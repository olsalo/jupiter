import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/calendar-booking-notes",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server")
let organizationId: string | undefined
let userId: string | undefined

try {
  const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
  const suffix = randomUUID()
  const owner = await prisma.user.create({ data: { name: "Booking notes test", email: `booking-notes-${suffix}@example.invalid`, emailVerified: true } })
  userId = owner.id
  const organization = await prisma.organization.create({ data: {
    name: "Booking notes test", slug: `booking-notes-${suffix}`, createdAt: new Date(),
    settings: { create: { timezone: "UTC" } },
    members: { create: { userId, role: "owner", createdAt: new Date() } },
  } })
  organizationId = organization.id
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: organizationId, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user: owner, session, organizationId, formatLocale: "en-GB", formatPreference: "eu", locale: "en" })
  const customer = await prisma.customer.create({ data: { organizationId, firstName: "Notes test customer" } })
  const customerNotes = "a".repeat(2000)
  const memberNotes = "b".repeat(2000)
  const appointment = await prisma.appointment.create({ data: {
    organizationId, customerId: customer.id, bookingCode: suffix.replaceAll("-", ""), status: "CONFIRMED",
    startsAt: new Date(Date.now() + 86400000), endsAt: new Date(Date.now() + 88200000), timezone: "UTC",
    customerNotes, internalNotes: memberNotes,
  } })
  const combined = `${customerNotes}\n\n${memberNotes}`
  const saved = await caller.appointment.update({ id: appointment.id, customerId: customer.id, customerNotes: null, internalNotes: combined })
  assert.equal(saved.customerNotes, null)
  assert.equal(saved.internalNotes, combined, "Both maximum-length original notes survive saving")
  const reopened = await caller.appointment.get({ id: appointment.id })
  assert.equal(reopened.customerNotes, null)
  assert.equal(reopened.internalNotes, combined, "Reopening retains the combined note without duplicating the customer message")
  const anonymous = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user: undefined, session: undefined, organizationId: null, formatLocale: "en-GB", formatPreference: "eu", locale: "en" })
  const publicBooking = await anonymous.booking.getByCode({ bookingCode: appointment.bookingCode })
  assert.equal("internalNotes" in publicBooking, false)
  assert.equal("customerNotes" in publicBooking, false)
  const cleared = await caller.appointment.update({ id: appointment.id, customerId: customer.id, customerNotes: null, internalNotes: "" })
  assert.equal(cleared.customerNotes, null)
  assert.equal(cleared.internalNotes, "", "Clearing the field does not restore the old customer message")
  console.info("PASS combined booking notes save, reopen and clear through tRPC, preserve maximum-length notes and stay out of public responses")
} finally {
  try {
    if (organizationId) {
      await prisma.appointment.deleteMany({ where: { organizationId } })
      await prisma.organization.delete({ where: { id: organizationId } })
    }
    if (userId) await prisma.user.delete({ where: { id: userId } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
