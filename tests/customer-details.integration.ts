import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/customer-details", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { customerRouter } = await vite.ssrLoadModule("/app/.server/routers/customers.ts") as typeof import("../app/.server/routers/customers")
const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
const router = createTRPCRouter({ customer: customerRouter })
const suffix = randomUUID()
const orgIds: string[] = []
let userId: string | undefined
try {
  const user = await prisma.user.create({ data: { name: "Customer details test", email: `customer-details-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  for (const name of ["Customer test", "Other business"]) {
    const org = await prisma.organization.create({ data: { name, slug: `${name.toLowerCase().replaceAll(" ", "-")}-${suffix}`, createdAt: new Date(), members: { create: { userId: user.id, role: "member", createdAt: new Date() } } } })
    orgIds.push(org.id)
  }
  const context = { headers: new Headers(), prisma, user, session: { activeOrganizationId: orgIds[0] }, organizationId: orgIds[0], formatLocale: "fi-FI", formatPreference: "eu", locale: "en" }
  const caller = router.createCaller(context as unknown as Parameters<typeof router.createCaller>[0])
  const customer = await prisma.customer.create({ data: { organizationId: orgIds[0], firstName: "Aino" } })
  const second = await prisma.customer.create({ data: { organizationId: orgIds[0], firstName: "Second" } })
  const foreign = await prisma.customer.create({ data: { organizationId: orgIds[1], firstName: "Foreign" } })

  const note = await caller.customer.addNote({ id: customer.id, body: "  Prefers a quiet room  " })
  assert.equal(note.body, "Prefers a quiet room")
  assert.equal(note.authorUserId, user.id)
  assert.equal(note.organizationId, orgIds[0])
  await assert.rejects(caller.customer.addNote({ id: customer.id, body: "  " }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.customer.addNote({ id: customer.id, body: "a".repeat(4001) }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.customer.addNote({ id: foreign.id, body: "Forbidden" }), { code: "NOT_FOUND" })
  await assert.rejects(caller.customer.listNotes({ id: foreign.id }), { code: "NOT_FOUND" })
  await assert.rejects(caller.customer.updateNote({ id: second.id, noteId: note.id, body: "Wrong customer" }), { code: "NOT_FOUND" })
  const foreignNote = await prisma.customerNote.create({ data: { organizationId: orgIds[1], customerId: foreign.id, body: "Private" } })
  await assert.rejects(caller.customer.updateNote({ id: customer.id, noteId: foreignNote.id, body: "Wrong business" }), { code: "NOT_FOUND" })
  await caller.customer.updateNote({ id: customer.id, noteId: note.id, body: "Updated preference" })
  const listed = await caller.customer.listNotes({ id: customer.id })
  assert.equal(listed.items[0].body, "Updated preference")
  assert.equal(listed.items[0].authorName, user.name)
  assert.equal(listed.items[0].authorUserId, user.id)
  const nextNote = await caller.customer.addNote({ id: customer.id, body: "Second note" })
  await prisma.customerNote.update({ where: { id: nextNote.id }, data: { createdAt: new Date(+note.createdAt + 1000) } })
  const notesPage = await caller.customer.listNotes({ id: customer.id, limit: 1 })
  assert.equal(notesPage.items[0].id, nextNote.id)
  assert.equal(notesPage.nextCursor, nextNote.id)
  assert.deepEqual((await caller.customer.listNotes({ id: customer.id, limit: 1, cursor: notesPage.nextCursor })).items.map((item) => item.id), [note.id])
  await assert.rejects(caller.customer.listNotes({ id: customer.id, cursor: foreignNote.id }), { code: "NOT_FOUND" })

  const now = Date.now()
  const createAppointment = (offset: number, status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW", customerId = customer.id, organizationId = orgIds[0]) => prisma.appointment.create({ data: { organizationId, customerId, bookingCode: randomUUID(), startsAt: new Date(now + offset * 86400000), endsAt: new Date(now + offset * 86400000 + 3600000), timezone: "Europe/Helsinki", status } })
  const later = await createAppointment(3, "CONFIRMED")
  const sooner = await createAppointment(1, "CONFIRMED")
  const tie = await createAppointment(1, "CONFIRMED")
  const past = await createAppointment(-1, "COMPLETED")
  const older = await createAppointment(-3, "NO_SHOW")
  const cancelled = await createAppointment(2, "CANCELLED")
  const foreignAppointment = await createAppointment(1, "CONFIRMED", foreign.id, orgIds[1])
  const detail = await caller.customer.get({ id: customer.id })
  assert.equal(detail.id, customer.id)
  assert.equal(detail.appointments.upcoming.items.length, 3)
  assert.deepEqual(detail.appointments.history.items.map((item) => item.id), [cancelled.id, past.id, older.id])
  assert.equal(detail.appointments.recent.items[0].id, past.id)
  await assert.rejects(caller.customer.get({ id: foreign.id }), { code: "NOT_FOUND" })
  const upcoming = await caller.customer.getAppointments({ id: customer.id, scope: "upcoming", limit: 1 })
  const sameTime = new Set([sooner.id, tie.id])
  assert.ok(sameTime.has(upcoming.items[0].id), "Upcoming bookings sort by time rather than random IDs")
  const page2 = await caller.customer.getAppointments({ id: customer.id, scope: "upcoming", limit: 1, cursor: upcoming.nextCursor })
  assert.notEqual(page2.items[0].id, upcoming.items[0].id, "Equal start times paginate without duplicates")
  assert.ok(sameTime.has(page2.items[0].id))
  const page3 = await caller.customer.getAppointments({ id: customer.id, scope: "upcoming", limit: 1, cursor: page2.nextCursor })
  assert.equal(page3.items[0].id, later.id)
  assert.equal(page3.nextCursor, undefined)
  const history = await caller.customer.getAppointments({ id: customer.id, scope: "history" })
  assert.deepEqual(history.items.map((item) => item.id), [cancelled.id, past.id, older.id])
  assert.equal((await caller.customer.getAppointments({ id: customer.id, scope: "recent", limit: 1 })).items[0].id, past.id, "Recent visit excludes future cancellations")
  assert.equal((await caller.customer.getAppointments({ id: customer.id })).items.length, 6, "Existing unfiltered callers retain access to all bookings")
  await assert.rejects(caller.customer.getAppointments({ id: foreign.id }), { code: "NOT_FOUND" })
  await assert.rejects(caller.customer.getAppointments({ id: customer.id, cursor: foreignAppointment.id }), { code: "NOT_FOUND" })
  await Promise.all(Array.from({ length: 21 }, (_, index) => createAppointment(index + 1, "CONFIRMED", second.id)))
  const paginatedDetail = await caller.customer.get({ id: second.id })
  assert.equal(paginatedDetail.appointments.upcoming.items.length, 20)
  assert.ok(paginatedDetail.appointments.upcoming.nextCursor)
  const remainingAppointments = await caller.customer.getAppointments({ id: second.id, scope: "upcoming", cursor: paginatedDetail.appointments.upcoming.nextCursor })
  assert.equal(remainingAppointments.items.length, 1)
  assert.ok(!paginatedDetail.appointments.upcoming.items.some((item) => item.id === remainingAppointments.items[0].id))
  const anonymous = router.createCaller({ ...context, user: undefined } as unknown as Parameters<typeof router.createCaller>[0])
  await assert.rejects(anonymous.customer.addNote({ id: customer.id, body: "Denied" }), { code: "UNAUTHORIZED" })
  await assert.rejects(anonymous.customer.listNotes({ id: customer.id }), { code: "UNAUTHORIZED" })
  console.info("PASS customer notes, validation, authorship, member access, business isolation, chronological appointments and cursor pagination")
} finally {
  try {
    if (orgIds.length) {
      await prisma.appointment.deleteMany({ where: { organizationId: { in: orgIds } } })
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    }
    if (userId) await prisma.user.delete({ where: { id: userId } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
