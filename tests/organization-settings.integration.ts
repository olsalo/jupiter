import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const jobs = await vite.ssrLoadModule("/app/.server/jobs/appointments.ts") as typeof import("../app/.server/jobs/appointments")
const orgIds: string[] = []
const userIds: string[] = []
const suffix = randomUUID()
try {
  const user = await prisma.user.create({ data: { name: "Settings test", email: `settings-${suffix}@example.invalid`, emailVerified: true } })
  userIds.push(user.id)
  const org = await prisma.organization.create({ data: { name: "Settings test", slug: `settings-${suffix}`, createdAt: new Date(), settings: { create: { timezone: "UTC" } }, members: { create: { userId: user.id, role: "owner", createdAt: new Date() } } } })
  orgIds.push(org.id)
  const foreign = await prisma.organization.create({ data: { name: "Foreign settings", slug: `foreign-settings-${suffix}`, createdAt: new Date() } })
  orgIds.push(foreign.id)
  const session = await prisma.session.create({ data: { token: randomUUID(), userId: user.id, activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 86400000) } })
  const context = { headers: new Headers(), request: undefined, prisma, user, session, organizationId: org.id, formatPreference: "eu" as const, formatLocale: "fi-FI", locale: "en" as const }
  const caller = appRouter.createCaller(context)
  const anonymous = appRouter.createCaller({ ...context, user: undefined, session: undefined, organizationId: null })
  const input = {
    businessName: "Updated business", businessId: "1234567-8", timezone: "UTC", country: "fi", currency: "usd", weekStartsOn: 0,
    defaultSlotIntervalMinutes: 30, minBookingNoticeMinutes: 120, maxBookingAdvanceDays: 30,
    cancellationNoticeMinutes: 60, rescheduleNoticeMinutes: 90, requireCustomerEmail: true, requireCustomerPhone: true,
    autoConfirmAppointments: false, allowCustomerCancellation: false, allowCustomerRescheduling: false, bookingEnabled: true,
    defaultTimezone: "Europe/Helsinki", defaultCalendarView: "month" as const, defaultStartHour: 9, defaultEndHour: 17,
    showWeekends: false, showCancelledAppointments: false, calendarSlotIntervalMinutes: 15,
    sendBookingConfirmations: true, sendCancellationEmails: true, sendRescheduleEmails: true,
    enableAppointmentReminders: true, reminderOffsetsMinutes: [1440, 120], senderName: "Small business", replyToAddress: " reply@example.invalid ",
  }
  const saved = await caller.organizations.updateSettings(input)
  assert.equal(saved.location, "FI")
  assert.equal(saved.currency, "USD")
  assert.deepEqual(saved.reminderOffsetsMinutes, [1440, 120])
  const general = await caller.organizations.general()
  assert.equal(general.businessName, input.businessName)
  assert.equal(general.businessId, input.businessId)
  assert.equal(general.weekStartsOn, 0)
  assert.equal(general.country, "FI")
  const current = await caller.organizations.getCurrent()
  for (const field of ["defaultCalendarView", "defaultStartHour", "defaultEndHour", "showWeekends", "showCancelledAppointments", "calendarSlotIntervalMinutes", "senderName"] as const) assert.equal(current.settings![field], input[field])
  await assert.rejects(caller.organizations.updateSettings({ defaultStartHour: 20 }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.updateSettings({ timezone: "Invalid/Zone" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.updateSettings({ country: "ZZ" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.updateSettings({ reminderOffsetsMinutes: [120, 120] }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.updateSettings({ senderName: "Name\nInjected" }), { code: "BAD_REQUEST" })
  assert.equal((await caller.organizations.getCurrent()).settings!.defaultStartHour, 9)
  const location = await caller.location.create({ name: "Default office", slug: "default-office" })
  const pageLocation = await caller.location.create({ name: "Page office", slug: "page-office" })
  const foreignLocation = await prisma.location.create({ data: { organizationId: foreign.id, name: "Foreign", slug: "foreign" } })
  const foreignPage = await prisma.bookingPage.create({ data: { organizationId: foreign.id, name: "Foreign", slug: "foreign" } })
  await assert.rejects(caller.organizations.updateSettings({ defaultLocationId: foreignLocation.id }), { code: "NOT_FOUND" })
  await assert.rejects(caller.organizations.updateSettings({ defaultBookingPageId: foreignPage.id }), { code: "NOT_FOUND" })
  const service = await caller.service.create({ name: "Appointment", slug: "appointment", durationMinutes: 30, deliveryType: "IN_PERSON", minBookingNoticeMinutes: 60, cancellationNoticeMinutes: 10, rescheduleNoticeMinutes: 20 })
  assert.equal(service.currency, "USD")
  await caller.service.setLocations({ id: service.id, ids: [location.id, pageLocation.id] })
  const staff = await caller.staff.create({ name: "Staff", serviceIds: [service.id], locationIds: [location.id, pageLocation.id] })
  const from = new Date(Date.now() + 5 * 86400000)
  from.setUTCHours(0, 0, 0, 0)
  const to = new Date(+from + 86400000)
  await caller.availability.replaceRules({ staffMemberId: staff.id, rules: [{ dayOfWeek: from.getUTCDay(), startMinute: 540, endMinute: 780, timezone: "UTC" }] })
  const page = await prisma.bookingPage.create({ data: { organizationId: org.id, name: "Default page", slug: "default", defaultLocationId: pageLocation.id, services: { create: { serviceId: service.id } } } })
  await caller.organizations.updateSettings({ defaultLocationId: location.id, defaultBookingPageId: page.id })
  assert.equal((await anonymous.booking.getPage({ organizationSlug: org.slug })).page!.slug, "default")
  const query = { organizationSlug: org.slug, serviceId: service.id, from, to }
  const slots = (await anonymous.booking.getAvailableSlots(query)).days[0].slots
  assert.equal(slots.length, 8)
  assert.ok(slots.every((slot) => slot.locationId === pageLocation.id))
  assert.ok((await caller.availability.getSlots({ serviceId: service.id, from, to })).days[0].slots.every((slot) => slot.locationId === location.id))
  const bookingInput = { organizationSlug: org.slug, serviceId: service.id, startsAt: new Date(slots[0].startsAt), customer: { firstName: "Guest", email: `guest-${suffix}@example.invalid` } }
  await assert.rejects(anonymous.booking.create(bookingInput), { code: "BAD_REQUEST" })
  const booking = await anonymous.booking.create({ ...bookingInput, customer: { ...bookingInput.customer, phone: "+358 401234567" } })
  assert.equal(booking.status, "PENDING")
  assert.equal(booking.timezone, "Europe/Helsinki")
  const appointment = await prisma.appointment.findUniqueOrThrow({ where: { bookingCode: booking.bookingCode } })
  const pendingReminders = () => prisma.notification.findMany({ where: { organizationId: org.id, appointmentId: appointment.id, kind: "REMINDER", status: "SCHEDULED" } })
  assert.deepEqual((await pendingReminders()).map((notification) => +appointment.startsAt - +notification.scheduledAt!).sort((a, b) => a - b), [120, 1440].map((minutes) => minutes * 60000))
  await assert.rejects(anonymous.booking.cancel({ bookingCode: booking.bookingCode }), { code: "BAD_REQUEST" })
  await assert.rejects(anonymous.booking.reschedule({ bookingCode: booking.bookingCode, startsAt: new Date(slots[1].startsAt) }), { code: "BAD_REQUEST" })
  await caller.organizations.updateSettings({ enableAppointmentReminders: false })
  assert.equal((await pendingReminders()).length, 0)
  await caller.organizations.updateSettings({ enableAppointmentReminders: true, reminderOffsetsMinutes: [120] })
  assert.equal((await pendingReminders()).length, 1)
  await caller.organizations.updateSettings({ reminderOffsetsMinutes: [1440, 120] })
  assert.equal((await pendingReminders()).length, 2)
  const scopedDb = Object.create(prisma) as typeof prisma
  Object.defineProperty(scopedDb, "notification", { value: { ...prisma.notification, findMany: (args: Parameters<typeof prisma.notification.findMany>[0]) => prisma.notification.findMany({ ...args, where: { ...args?.where, organizationId: org.id } }), updateMany: prisma.notification.updateMany.bind(prisma.notification) } })
  const delivered: import("../app/lib/email.server").EmailMessage[] = []
  await jobs.sendPendingNotifications(scopedDb, { send: async (message) => { delivered.push(message) } })
  assert.equal(delivered.length, 1)
  assert.equal(delivered[0].senderName, "Small business")
  assert.equal(delivered[0].replyTo, "reply@example.invalid")
  await caller.appointment.cancel({ id: appointment.id })
  assert.equal((await caller.appointment.list({ from, to })).length, 0)
  assert.equal((await caller.appointment.list({ from, to, includeCancelled: true })).length, 1)
  assert.equal((await caller.appointment.list({ from, to, status: "CANCELLED" })).length, 1)
  const member = await prisma.member.findFirstOrThrow({ where: { organizationId: org.id, userId: user.id } })
  await prisma.member.update({ where: { id: member.id }, data: { role: "member" } })
  await assert.rejects(caller.organizations.updateSettings({ senderName: "Denied" }), { code: "FORBIDDEN" })
  await prisma.member.update({ where: { id: member.id }, data: { role: "admin" } })
  await caller.organizations.updateSettings({ defaultLocationId: null, defaultBookingPageId: null, defaultTimezone: null })
  assert.equal((await caller.organizations.getCurrent()).settings!.defaultLocationId, null)
  console.info("PASS settings roundtrip, validation, tenant defaults, booking rules, multiple reminders, reminder changes, sender/reply-to, calendar cancellation filtering and roles")
} finally {
  try {
    await prisma.appointment.deleteMany({ where: { organizationId: { in: orgIds } } })
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
