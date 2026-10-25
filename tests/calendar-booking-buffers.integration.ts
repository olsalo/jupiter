import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-tests/calendar-booking-buffers", appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { ws: false, middlewareMode: true, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
let organizationId: string | undefined
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Buffer test", email: `buffers-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const organization = await prisma.organization.create({ data: {
    name: "Buffer test", slug: `buffers-${suffix}`, createdAt: new Date(), settings: { create: { timezone: "UTC" } },
    members: { create: { userId: user.id, role: "owner", createdAt: new Date() } },
  } })
  organizationId = organization.id
  const session = await prisma.session.create({ data: { token: randomUUID(), userId: user.id, activeOrganizationId: organization.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId, formatLocale: "en-GB", formatPreference: "eu", locale: "en" })
  const service = await caller.service.create({ name: "Consultation", durationMinutes: 30, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, deliveryType: "ONLINE" })
  const staff = await caller.staff.create({ name: "Aino", serviceIds: [service.id] })
  const customer = await caller.customer.create({ firstName: "Matti" })
  const from = new Date("2026-10-12T00:00:00Z")
  const to = new Date(+from + 86400000)
  const at = (minute: number) => new Date(+from + minute * 60000)
  await caller.availability.replaceRules({ staffMemberId: staff.id, rules: [{ dayOfWeek: 1, startMinute: 540, endMinute: 720, timezone: "UTC" }] })
  const input = { serviceId: service.id, staffMemberId: staff.id, customerId: customer.id, durationMinutes: 30 }
  const booking = await caller.appointment.create({ ...input, startsAt: at(600) })
  await caller.appointment.complete({ id: booking.id })
  const slots = (await caller.availability.getBookingTimes({ serviceId: service.id, staffMemberId: staff.id, from, to, durationMinutes: 30 })).days.flatMap((day) => day.slots)
  assert.ok(!slots.some((slot) => +new Date(slot.startsAt) - 5 * 60000 < +at(640) && +new Date(slot.endsAt) + 10 * 60000 > +at(595)), "Completed past bookings reserve both buffers in the time picker")
  for (const minute of [570, 600, 630, 640]) {
    await assert.rejects(caller.appointment.create({ ...input, startsAt: at(minute) }), { code: "CONFLICT" }, "Saving cannot overlap either booking's buffers in the past")
  }
  assert.ok(slots.some((slot) => slot.startsAt === at(645).toISOString()), "Cleanup and preparation buffers may touch exactly")
  const next = await caller.appointment.create({ ...input, startsAt: at(645) })
  await assert.rejects(caller.appointment.update({ id: next.id, customerId: customer.id, internalNotes: "", startsAt: at(640) }), { code: "CONFLICT" }, "Moving a booking cannot overlap a completed booking's buffer")
  assert.equal((await caller.appointment.get({ id: next.id })).startsAt.toISOString(), at(645).toISOString(), "A rejected move preserves the saved booking")
  console.info("PASS completed past booking buffers in availability, creation, rescheduling and exact touching edges")
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
