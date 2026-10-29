import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/communications", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { queueNotification } = await vite.ssrLoadModule("/app/.server/services/notifications.ts") as typeof import("../app/.server/services/notifications")
const { sendPendingNotifications } = await vite.ssrLoadModule("/app/.server/jobs/appointments.ts") as typeof import("../app/.server/jobs/appointments")
const orgIds: string[] = []
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Communications test", email: `communications-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const org = await prisma.organization.create({ data: { name: "Kädet & Co", slug: `communications-${suffix}`, createdAt: new Date(), members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  orgIds.push(org.id)
  const foreign = await prisma.organization.create({ data: { name: "Other business", slug: `communications-foreign-${suffix}`, createdAt: new Date(), settings: { create: { senderName: "Unchanged" } } } })
  orgIds.push(foreign.id)
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId: org.id, formatPreference: "eu", formatLocale: "fi-FI", locale: "en" })
  const defaults = await caller.organizations.communicationsSettings()
  assert.deepEqual(defaults.reminderOffsetsMinutes, [1440])
  assert.equal(defaults.senderName, "")
  const saved = await caller.organizations.updateCommunicationsSettings({ ...defaults, senderName: " Kädet & Co ", replyToAddress: " REPLY@example.invalid ", reminderOffsetsMinutes: [1440, 120] })
  assert.equal(saved.senderName, "Kädet & Co")
  assert.equal(saved.replyToAddress, "reply@example.invalid")
  assert.deepEqual(await caller.organizations.communicationsSettings(), saved)
  for (const invalid of [{ reminderOffsetsMinutes: [] }, { reminderOffsetsMinutes: [60, 60] }, { reminderOffsetsMinutes: [0] }, { reminderOffsetsMinutes: [10081] }, { reminderOffsetsMinutes: [1, 2, 3, 4, 5, 6] }, { senderName: "Name\nInjected" }, { replyToAddress: "invalid" }]) {
    await assert.rejects(caller.organizations.updateCommunicationsSettings(invalid), { code: "BAD_REQUEST" })
  }
  const customer = await prisma.customer.create({ data: { organizationId: org.id, firstName: "Test", email: `customer-${suffix}@example.invalid`, locale: "fi" } })
  const startsAt = new Date(Date.now() + 4 * 86400000)
  const appointment = await prisma.appointment.create({ data: { organizationId: org.id, customerId: customer.id, bookingCode: suffix, startsAt, endsAt: new Date(+startsAt + 1800000), timezone: "Europe/Helsinki", status: "CONFIRMED" } })
  await queueNotification(prisma, org.id, appointment.id, "BOOKING_CONFIRMATION")
  await queueNotification(prisma, org.id, appointment.id, "REMINDER")
  const reminders = () => prisma.notification.findMany({ where: { organizationId: org.id, kind: "REMINDER", status: "SCHEDULED" } })
  assert.equal((await reminders()).length, 2)
  const confirmation = await prisma.notification.findFirstOrThrow({ where: { organizationId: org.id, kind: "BOOKING_CONFIRMATION" } })
  assert.equal(confirmation.subject, "Varaus vastaanotettu")
  assert.match(confirmation.body, /Kädet & Co/)
  assert.match(JSON.stringify(confirmation.metadata), /Kädet &amp; Co/)
  const alreadySent = (await reminders()).find((notification) => (notification.metadata as { reminderOffsetMinutes: number }).reminderOffsetMinutes === 1440)!
  await prisma.notification.update({ where: { id: alreadySent.id }, data: { status: "SENT", sentAt: new Date() } })
  await caller.organizations.updateCommunicationsSettings({ reminderOffsetsMinutes: [1440, 60] })
  assert.equal((await reminders()).length, 1)
  assert.equal((await reminders())[0].scheduledAt!.getTime(), +startsAt - 3600000)
  await caller.organizations.updateCommunicationsSettings({ enableAppointmentReminders: false })
  assert.equal((await reminders()).length, 0)
  const disabledSettings = await caller.organizations.updateCommunicationsSettings({ reminderOffsetsMinutes: [1440, 120] })
  assert.equal(disabledSettings.enableAppointmentReminders, false)
  assert.deepEqual((await caller.organizations.communicationsSettings()).reminderOffsetsMinutes, [1440, 120])
  assert.equal((await reminders()).length, 0, "Saving timing while reminders are off does not schedule reminders")
  await caller.organizations.updateCommunicationsSettings({ enableAppointmentReminders: true })
  assert.equal((await reminders()).length, 1)
  assert.equal((await reminders())[0].scheduledAt!.getTime(), +startsAt - 7200000, "Enabling reminders uses the timing saved while disabled")
  // Scope the worker to this test's outbox so other tenants' emails are untouched
  const scopedDb = Object.create(prisma) as typeof prisma
  Object.defineProperty(scopedDb, "notification", { value: { ...prisma.notification, findMany: (args: Parameters<typeof prisma.notification.findMany>[0]) => prisma.notification.findMany({ ...args, where: { ...args?.where, organizationId: org.id } }), updateMany: prisma.notification.updateMany.bind(prisma.notification) } })
  const delivered: import("../app/lib/email/email.server.ts").EmailMessage[] = []
  assert.deepEqual(await sendPendingNotifications(scopedDb, { send: async (message) => { delivered.push(message) } }), { sent: 1, failed: 0 })
  assert.equal(delivered[0].senderName, saved.senderName)
  assert.equal(delivered[0].replyTo, saved.replyToAddress)
  assert.match(delivered[0].html, /<html[^>]*lang="fi"/)
  await prisma.customer.update({ where: { id: customer.id }, data: { locale: "en" } })
  await queueNotification(prisma, org.id, appointment.id, "RESCHEDULE")
  const reschedule = await prisma.notification.findFirstOrThrow({ where: { organizationId: org.id, kind: "RESCHEDULE" } })
  assert.equal(reschedule.subject, "Booking rescheduled")
  assert.match(reschedule.body, /Booking code/)
  assert.match((reschedule.metadata as { emailHtml: string }).emailHtml, /<html[^>]*lang="en"/)

  await caller.organizations.updateCommunicationsSettings({ sendRescheduleEmails: false })
  assert.deepEqual(await sendPendingNotifications(scopedDb, { send: async () => { assert.fail("Disabled email was delivered") } }), { sent: 0, failed: 0 })
  await queueNotification(prisma, org.id, appointment.id, "CANCELLATION")
  const queuedCancellation = await prisma.notification.findFirstOrThrow({ where: { organizationId: org.id, kind: "CANCELLATION" } })
  assert.deepEqual(await sendPendingNotifications(scopedDb, { send: async () => { throw new Error("Provider failure") } }), { sent: 0, failed: 1 })
  const failed = await prisma.notification.findFirstOrThrow({ where: { organizationId: org.id, kind: "CANCELLATION" } })
  assert.equal(failed.status, "SCHEDULED")
  assert.equal(failed.errorMessage, "Email delivery failed")
  assert.ok(failed.nextAttemptAt! > new Date())
  assert.equal(+failed.scheduledAt!, +queuedCancellation.scheduledAt!, "Retry scheduling preserves the original send time")
  assert.equal(failed.attempts, 1)
  assert.equal(failed.lockedUntil, null)
  assert.equal(failed.leaseToken, null)
  assert.equal((failed.metadata as Record<string, unknown>).attempts, undefined)
  let retryDeliveries = 0
  const retryNow = new Date(+failed.nextAttemptAt! + 1)
  const concurrentRetry = await Promise.all([1, 2].map(() => sendPendingNotifications(scopedDb, { now: retryNow, send: async () => { retryDeliveries++ } })))
  assert.equal(retryDeliveries, 1, "Two workers claim one scheduled retry only once")
  assert.equal(concurrentRetry.reduce((total, result) => total + result.sent, 0), 1)
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: failed.id } })).attempts, 2)
  const exhausted = await prisma.notification.create({ data: { organizationId: org.id, kind: "CUSTOM", channel: "EMAIL", recipient: `retry-${suffix}@example.invalid`, body: "Retry limit", scheduledAt: new Date(0) } })
  let attemptTime = new Date()
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal((await sendPendingNotifications(scopedDb, { now: attemptTime, send: async () => { throw new Error("Provider down") } })).failed, 1)
    const storedAttempt = await prisma.notification.findUniqueOrThrow({ where: { id: exhausted.id } })
    assert.equal(storedAttempt.attempts, attempt)
    assert.equal(storedAttempt.lockedUntil, null)
    attemptTime = new Date(+storedAttempt.nextAttemptAt! + 1)
  }
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: exhausted.id } })).status, "FAILED")
  assert.deepEqual(await sendPendingNotifications(scopedDb, { now: attemptTime, send: async () => { assert.fail("Exhausted retry was delivered") } }), { sent: 0, failed: 0 })
  await caller.organizations.updateCommunicationsSettings({ senderName: "", replyToAddress: "" })
  const stored = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: org.id } })
  assert.equal(stored.senderName, null)
  assert.equal(stored.replyToAddress, null)
  assert.equal((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: foreign.id } })).senderName, "Unchanged")
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "member" } })
  await assert.rejects(caller.organizations.communicationsSettings(), { code: "FORBIDDEN" })
  await assert.rejects(caller.organizations.updateCommunicationsSettings({ sendCancellationEmails: false }), { code: "FORBIDDEN" })
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "admin" } })
  await caller.organizations.updateCommunicationsSettings({ sendCancellationEmails: false })
  console.info("PASS communications defaults, persistence, permissions, tenant isolation, validation, Finnish React Email HTML, reminder rebuilding, sent-offset preservation, sender/reply-to, disabled messages and delivery retry")
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
