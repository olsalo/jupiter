import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-tests/calendar-booking-member-filter", appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname, "@": new URL("../app", import.meta.url).pathname, "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname } },
  server: { ws: false, middlewareMode: true, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
let organizationId: string | undefined
let userId: string | undefined
try {
  const { BookingMemberFilter } = await vite.ssrLoadModule("/app/components/calendar/booking-member-filter.tsx") as typeof import("../app/components/calendar/booking-member-filter")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const renderFilter = (value?: string) => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(BookingMemberFilter, {
    members: [{ id: "aino", name: "Aino" }], ownMemberId: "aino", value, onChange: () => {}, disabled: false,
  })))
  assert.match(renderFilter(), /Whole team/, "The default filter shows the whole team")
  assert.match(renderFilter("aino"), /Aino/)
  assert.match(renderFilter("aino"), /data-slot="badge"[^>]*>You</, "The current user's member has a You badge")
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Member filter test", email: `member-filter-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const organization = await prisma.organization.create({ data: {
    name: "Member filter test", slug: `member-filter-${suffix}`, createdAt: new Date(),
    settings: { create: { timezone: "UTC" } },
    members: { create: { userId: user.id, role: "owner", createdAt: new Date() } },
  } })
  organizationId = organization.id
  const session = await prisma.session.create({ data: { token: randomUUID(), userId: user.id, activeOrganizationId: organization.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId, formatLocale: "en-GB", formatPreference: "eu", locale: "en" })
  const service = await caller.service.create({ name: "Consultation", durationMinutes: 30, deliveryType: "ONLINE" })
  const aino = await caller.staff.create({ name: "Aino", serviceIds: [service.id] })
  const liisa = await caller.staff.create({ name: "Liisa", serviceIds: [service.id] })
  const from = new Date(Date.now() + 7 * 86400000)
  from.setUTCHours(0, 0, 0, 0)
  const to = new Date(+from + 86400000)
  for (const member of [aino, liisa]) await caller.availability.replaceRules({ staffMemberId: member.id, rules: [{ dayOfWeek: from.getUTCDay(), startMinute: 540, endMinute: 720, timezone: "UTC" }] })

  const range = { serviceId: service.id, from, to, durationMinutes: 30 }
  const all = (await caller.availability.getSlots(range)).days.flatMap((day) => day.slots)
  assert.deepEqual(new Set(all.map((slot) => slot.staffMemberId)), new Set([aino.id, liisa.id]))
  const draft = (await caller.availability.getBookingTimes({ from, to, durationMinutes: 30 })).days.flatMap((day) => day.slots)
  assert.deepEqual(new Set(draft.map((slot) => slot.staffMemberId)), new Set([aino.id, liisa.id]), "Whole-team draft times work before choosing a service")
  const filtered = (await caller.availability.getSlots({ ...range, staffMemberId: liisa.id })).days.flatMap((day) => day.slots)
  assert.ok(filtered.length > 0)
  assert.ok(filtered.every((slot) => slot.staffMemberId === liisa.id), "Create slots respect the member filter")
  const customer = await caller.customer.create({ firstName: "Test customer" })
  const originalSlot = all.find((slot) => slot.staffMemberId === aino.id)!
  const booking = await caller.appointment.create({ serviceId: service.id, customerId: customer.id, staffMemberId: aino.id, startsAt: new Date(originalSlot.startsAt), durationMinutes: 30 })
  const wholeTeamEdit = (await caller.appointment.getBookingTimes({ id: booking.id, from, to, durationMinutes: 30, staffMemberId: null })).days.flatMap((day) => day.slots)
  assert.deepEqual(new Set(wholeTeamEdit.map((slot) => slot.staffMemberId)), new Set([aino.id, liisa.id]), "The edit filter can list the whole team")
  const savedMemberEdit = (await caller.appointment.getBookingTimes({ id: booking.id, from, to, durationMinutes: 30 })).days.flatMap((day) => day.slots)
  assert.ok(savedMemberEdit.every((slot) => slot.staffMemberId === aino.id), "Existing callers without a filter keep the saved member")
  const editSlots = (await caller.appointment.getBookingTimes({ id: booking.id, from, to, durationMinutes: 30, staffMemberId: liisa.id })).days.flatMap((day) => day.slots)
  assert.ok(editSlots.length > 0)
  assert.ok(editSlots.every((slot) => slot.staffMemberId === liisa.id), "Edit slots respect the member filter")
  const sameTime = editSlots.find((slot) => slot.startsAt === originalSlot.startsAt)!
  assert.ok(sameTime, "Another member can offer the original time")
  const updated = await caller.appointment.update({ id: booking.id, customerId: customer.id, internalNotes: "Filtered slot", staffMemberId: liisa.id, startsAt: new Date(sameTime.startsAt), durationMinutes: 30 })
  assert.equal(updated.staffMemberId, liisa.id, "Saving a filtered edit updates the assigned member")
  assert.equal(updated.services[0].staffMemberId, liisa.id)
  assert.equal(+updated.startsAt, +booking.startsAt, "A member-only change preserves the selected time")
  console.info("PASS whole-team slots, create and edit member filters, and saving a member-only change")
  const replacement = await caller.service.create({ name: "Long consultation", durationMinutes: 45, price: "55.00", color: "#8f49b5", deliveryType: "ONLINE", bufferBeforeMinutes: 10, bufferAfterMinutes: 5 })
  await caller.staff.setServices({ id: liisa.id, ids: [service.id, replacement.id] })
  const replacementInput = { id: booking.id, from, to, durationMinutes: 45, serviceId: replacement.id, staffMemberId: null }
  const replacementSlots = (await caller.appointment.getBookingTimes(replacementInput)).days.flatMap((day) => day.slots)
  assert.ok(replacementSlots.length > 0)
  assert.ok(replacementSlots.every((slot) => slot.staffMemberId === liisa.id), "A service change only offers members assigned to the new service")
  assert.ok(replacementSlots.every((slot) => slot.startsAt !== originalSlot.startsAt), "Availability uses the new service's buffers")
  assert.equal((await caller.appointment.get({ id: booking.id })).services[0].serviceId, service.id, "Previewing service availability does not change the booking")
  const replacementStart = new Date(+from + 600 * 60000)
  assert.ok(replacementSlots.some((slot) => slot.startsAt === replacementStart.toISOString()))
  const replacementUpdate = { id: booking.id, customerId: customer.id, internalNotes: "Changed service", serviceId: replacement.id, startsAt: replacementStart, durationMinutes: 45, staffMemberId: liisa.id }
  await assert.rejects(caller.appointment.getBookingTimes({ ...replacementInput, staffMemberId: aino.id }), { code: "NOT_FOUND" })
  await assert.rejects(caller.appointment.update({ ...replacementUpdate, staffMemberId: aino.id }), { code: "NOT_FOUND" })
  await assert.rejects(caller.appointment.update({ ...replacementUpdate, serviceId: "missing-service" }), { code: "NOT_FOUND" })
  const unavailable = await caller.service.create({ name: "Hidden service", durationMinutes: 30, deliveryType: "ONLINE", isActive: false })
  await assert.rejects(caller.appointment.getBookingTimes({ ...replacementInput, serviceId: unavailable.id }), { code: "NOT_FOUND" })
  const conflicting = await caller.appointment.create({ serviceId: replacement.id, customerId: customer.id, staffMemberId: liisa.id, startsAt: replacementStart, durationMinutes: 45 })
  await assert.rejects(caller.appointment.update(replacementUpdate), { code: "CONFLICT" })
  const unchanged = await caller.appointment.get({ id: booking.id })
  assert.equal(unchanged.services[0].serviceId, service.id, "A conflicting service change preserves the original snapshot")
  assert.equal(unchanged.internalNotes, updated.internalNotes, "A conflicting service change preserves the other fields")
  await prisma.appointment.delete({ where: { id: conflicting.id, organizationId } })
  const changed = await caller.appointment.update(replacementUpdate)
  assert.equal(changed.services[0].serviceId, replacement.id)
  assert.equal(changed.services[0].name, replacement.name)
  assert.equal(changed.services[0].service.color, replacement.color)
  assert.equal(changed.services[0].durationMinutes, 45)
  assert.equal(changed.services[0].bufferBeforeMinutes, 10)
  assert.equal(changed.services[0].bufferAfterMinutes, 5)
  assert.equal(changed.services[0].unitPrice, "55")
  assert.equal(changed.services[0].totalPrice, "55")
  assert.equal(changed.subtotalAmount, "55")
  assert.equal(changed.totalAmount, "55")
  assert.equal(+changed.endsAt - +changed.startsAt, 45 * 60000)
  await caller.service.update({ id: replacement.id, name: "Renamed service", price: "99.00" })
  const durationOnly = await caller.appointment.update({ id: booking.id, customerId: customer.id, internalNotes: "Keep snapshot", durationMinutes: 50 })
  assert.equal(durationOnly.services[0].name, replacement.name, "Time edits preserve the booked service name")
  assert.equal(durationOnly.services[0].unitPrice, "55", "Time edits preserve the booked service price")
  console.info("PASS service changes use new availability, staff assignments, buffers, duration, prices and snapshots, with atomic rejection of invalid or conflicting changes")
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
