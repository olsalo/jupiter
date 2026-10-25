import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.STRIPE_SECRET_KEY = ""
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "false"
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/onboarding-flow",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const { getAvailableSlots } = await vite.ssrLoadModule("/app/.server/services/availability.ts") as typeof import("../app/.server/services/availability")
let userId: string | undefined
let organizationId: string | undefined
const originalCreateOrganization = auth.api.createOrganization
try {
  const user = await prisma.user.create({ data: { name: "Onboarding test", email: `onboarding-${randomUUID()}@example.invalid`, emailVerified: true } })
  userId = user.id
  // Keep auth transport outside this router test while persisting the same organization and membership
  auth.api.createOrganization = (async ({ body }: { body: { name: string; slug: string } }) => {
    const organization = await prisma.organization.create({ data: { ...body, createdAt: new Date(), members: { create: { userId: user.id, role: "owner", createdAt: new Date() } } } })
    organizationId = organization.id
    return organization
  }) as unknown as typeof auth.api.createOrganization
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, expiresAt: new Date(Date.now() + 86400000) } })
  const context = { headers: new Headers(), request: undefined, prisma, user, session, organizationId: null as string | null, formatPreference: "eu" as const, formatLocale: "fi-FI", locale: "en" as const }
  const caller = appRouter.createCaller(() => context)
  assert.equal((await caller.onboarding.status()).businessComplete, false)
  await assert.rejects(caller.onboarding.schedule(), { code: "FORBIDDEN" })
  const details = { name: "Matti Meikäläinen", businessName: `Onboarding ${randomUUID()}`, currency: "EUR", location: "fi", timezone: "Europe/Helsinki" }
  await assert.rejects(caller.onboarding.complete({ ...details, timezone: "invalid-zone" }), { code: "BAD_REQUEST" })
  const result = await caller.onboarding.complete(details)
  assert.equal(result.organizationId, organizationId)
  context.organizationId = result.organizationId
  context.session = await prisma.session.update({ where: { id: session.id }, data: { activeOrganizationId: organizationId } })
  const locations = await prisma.location.findMany({ where: { organizationId } })
  assert.equal(locations.length, 1)
  assert.equal(locations[0].country, "FI")
  assert.equal(locations[0].timezone, details.timezone)
  const owner = await prisma.staffMember.findFirstOrThrow({ where: { organizationId }, include: { staffLocations: true } })
  assert.equal(owner.name, details.name)
  assert.ok(owner.memberId)
  assert.equal(owner.staffLocations[0].locationId, locations[0].id)
  assert.equal(await prisma.availabilityRule.count({ where: { staffMemberId: owner.id } }), 0)
  assert.equal((await caller.onboarding.status()).availabilityComplete, false)
  await assert.rejects(caller.onboarding.complete(details), { code: "CONFLICT" })
  assert.equal(await prisma.location.count({ where: { organizationId } }), 1)
  let schedule = await caller.onboarding.schedule()
  await assert.rejects(caller.onboarding.confirmHolidays(schedule), { code: "CONFLICT" })
  const workingHours = [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020, isActive: true, timezone: details.timezone }]
  await caller.onboarding.saveAvailability({ workingHours, breaks: [] })
  assert.equal((await caller.onboarding.status()).availabilityComplete, true)
  assert.equal((await caller.onboarding.status()).holidaysComplete, false)
  schedule = await caller.onboarding.schedule()
  assert.equal(schedule.workingHours[0].startMinute, 540)
  const holidays = schedule.holidays.map((holiday) => ({ ...holiday, enabled: holiday.id === "christmas" }))
  await caller.onboarding.confirmHolidays({ ...schedule, holidays })
  assert.equal((await caller.onboarding.status()).setupComplete, true)
  assert.equal((await caller.onboarding.status()).holidaysComplete, true)
  await assert.rejects(caller.onboarding.confirmHolidays(schedule), { code: "CONFLICT" })
  const savedSettings = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })
  assert.equal(savedSettings.onboardingStep, null)
  assert.ok(savedSettings.businessHolidays)

  const service = await caller.service.create({ name: "Test service", slug: "test-service", durationMinutes: 30, deliveryType: "ONLINE" })
  await prisma.staffService.create({ data: { staffMemberId: owner.id, serviceId: service.id } })
  const slots = () => getAvailableSlots(prisma, result.organizationId, { serviceId: service.id, staffMemberId: owner.id, from: new Date("2027-01-11T00:00Z"), to: new Date("2027-01-12T00:00Z") }, { now: new Date("2027-01-01T00:00Z") })
  assert.equal((await slots()).days[0].slots[0].startsAt, "2027-01-11T07:00:00.000Z", "Owner inherits business hours")
  await caller.organizations.updateSettings({ defaultLocationId: locations[0].id })
  assert.equal((await slots()).days[0].slots[0].startsAt, "2027-01-11T07:00:00.000Z", "A default office does not prevent booking a locationless online service")
  const bookingPage = await caller.bookingPage.get()
  await caller.bookingPage.save({ ...bookingPage.values, defaultLocationId: locations[0].id, allowLocationSelection: false })
  const anonymous = appRouter.createCaller({ ...context, user: undefined, session: undefined, organizationId: null })
  const publicScope = { organizationSlug: (await caller.organizations.getCurrent()).slug, serviceId: service.id }
  const publicSlots = await anonymous.booking.getAvailableSlots({ ...publicScope, from: new Date("2027-01-11T00:00Z"), to: new Date("2027-01-12T00:00Z") })
  assert.equal(publicSlots.days[0].slots[0].locationId, null)
  const question = await prisma.bookingQuestion.create({ data: { organizationId: result.organizationId, serviceId: service.id, label: "Is this your first visit?", type: "BOOLEAN", required: true } })
  const booked = await anonymous.booking.create({ ...publicScope, startsAt: new Date(publicSlots.days[0].slots[0].startsAt), customer: { firstName: "Online customer", email: `online-${randomUUID()}@example.invalid` }, notes: "Please call before the appointment", answers: [{ questionId: question.id, value: false }] })
  assert.equal(booked.location, null)
  const appointment = await prisma.appointment.findUniqueOrThrow({ where: { bookingCode: booked.bookingCode } })
  const adminBooking = await caller.appointment.get({ id: appointment.id })
  assert.equal(adminBooking.customerNotes, "Please call before the appointment")
  assert.equal(adminBooking.answers[0].value, false, "A negative answer is saved and returned to the team")
  assert.equal(adminBooking.answers[0].question.label, question.label)
  assert.equal("answers" in booked, false, "Customer answers stay private on public booking links")
  await caller.appointment.delete({ id: appointment.id })
  await caller.organizations.updateSettings({ defaultLocationId: null })
  await prisma.availabilityRule.create({ data: { organizationId: result.organizationId, staffMemberId: owner.id, dayOfWeek: 1, startMinute: 660, endMinute: 780, timezone: details.timezone } })
  assert.equal((await slots()).days[0].slots[0].startsAt, "2027-01-11T09:00:00.000Z", "Custom hours replace business hours")
  await prisma.availabilityRule.create({ data: { organizationId: result.organizationId, staffMemberId: owner.id, locationId: locations[0].id, dayOfWeek: 1, startMinute: 720, endMinute: 780, timezone: details.timezone } })
  await caller.profile.resetTeamWorkingHours()
  assert.equal(await prisma.availabilityRule.count({ where: { staffMemberId: owner.id, isBreak: false } }), 0, "Reset clears custom rules")
  await caller.organizations.updateBusinessSchedule({ ...schedule, holidays, workingHours: [{ ...workingHours[0], startMinute: 600 }] })
  assert.equal((await slots()).days[0].slots[0].startsAt, "2027-01-11T08:00:00.000Z", "Reset members follow later changes to business hours")
  const another = await caller.staff.create({ name: "New team member", serviceIds: [service.id] })
  assert.equal(await prisma.availabilityRule.count({ where: { staffMemberId: another.id } }), 0, "New members inherit without copied rules")
  await prisma.member.update({ where: { id: owner.memberId! }, data: { role: "member" } })
  await assert.rejects(caller.onboarding.saveAvailability({ workingHours, breaks: [] }), { code: "FORBIDDEN" })
  await assert.rejects(caller.onboarding.confirmHolidays(schedule), { code: "FORBIDDEN" })
  console.info("PASS onboarding creation, one location, owner profile, saved steps, holiday confirmation, validation, permissions, inherited and custom schedules, reset and later default changes")
} finally {
  auth.api.createOrganization = originalCreateOrganization
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
