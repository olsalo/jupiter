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
    try {
      const organization = await prisma.organization.create({ data: { ...body, createdAt: new Date(), members: { create: { userId: user.id, role: "owner", createdAt: new Date() } } } })
      organizationId = organization.id
      return organization
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw Object.assign(new Error("Already exists"), { body: { code: "ORGANIZATION_SLUG_ALREADY_TAKEN" } })
      throw error
    }
  }) as unknown as typeof auth.api.createOrganization
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, expiresAt: new Date(Date.now() + 86400000) } })
  const context = { headers: new Headers(), request: undefined, prisma, user, session, organizationId: null as string | null, formatPreference: "eu" as const, formatLocale: "fi-FI", locale: "en" as const }
  const caller = appRouter.createCaller(() => context)
  assert.equal((await caller.onboarding.status()).businessComplete, false)
  await assert.rejects(caller.onboarding.schedule(), { code: "FORBIDDEN" })
  const details = { name: "Matti Meikäläinen", businessName: `Onboarding ${randomUUID()}`, currency: "EUR", location: "fi", timezone: "Europe/Helsinki" }
  await assert.rejects(caller.onboarding.complete({ ...details, timezone: "invalid-zone" }), { code: "BAD_REQUEST" })
  const created = await Promise.all([caller.onboarding.complete(details), caller.onboarding.complete(details)])
  const result = created[0]
  assert.ok(created.every((entry) => entry.organizationId === result.organizationId), "Concurrent first-step retries reuse the same business")
  assert.equal(result.organizationId, organizationId)
  context.organizationId = result.organizationId
  context.session = await prisma.session.update({ where: { id: session.id }, data: { activeOrganizationId: organizationId } })
  assert.equal(await prisma.location.count({ where: { organizationId } }), 0, "The business step does not create a location")
  let owner = await prisma.staffMember.findFirstOrThrow({ where: { organizationId }, include: { staffLocations: true } })
  assert.equal(owner.name, details.name)
  assert.ok(owner.memberId)
  assert.deepEqual(owner.staffLocations, [], "The owner is linked only after the location step")
  assert.equal((await caller.onboarding.status()).locationComplete, false)
  assert.equal((await caller.onboarding.status()).availabilityComplete, false)
  const locationDefaults = await caller.onboarding.location()
  assert.equal(locationDefaults.name, details.businessName)
  assert.equal(locationDefaults.country, "FI")
  assert.equal(locationDefaults.phone, "")
  assert.equal(locationDefaults.email, "")
  const locationValues = { id: null, name: details.businessName, addressLine1: "Esimerkkikatu 1", addressLine2: "", postalCode: "00100", city: "Helsinki", country: "FI", phone: "", email: "", timezone: "America/New_York" }
  await assert.rejects(caller.onboarding.saveLocation({ ...locationValues, addressLine1: "" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.onboarding.saveLocation({ ...locationValues, email: "invalid" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.onboarding.saveAvailability({ workingHours: [], breaks: [] }), { code: "CONFLICT" }, "Opening hours cannot skip the location step")
  await caller.onboarding.saveLocation(locationValues)
  const locations = await prisma.location.findMany({ where: { organizationId } })
  assert.equal(locations.length, 1)
  assert.equal(locations[0].name, details.businessName)
  assert.equal(locations[0].addressLine1, locationValues.addressLine1)
  assert.equal(locations[0].postalCode, locationValues.postalCode)
  assert.equal(locations[0].city, locationValues.city)
  assert.equal(locations[0].country, "FI")
  assert.equal(locations[0].timezone, details.timezone, "Location always uses the business timezone")
  assert.equal(locations[0].phone, null)
  assert.equal(locations[0].email, null)
  owner = await prisma.staffMember.findFirstOrThrow({ where: { organizationId }, include: { staffLocations: true } })
  assert.equal(owner.staffLocations[0].locationId, locations[0].id)
  assert.equal(await prisma.availabilityRule.count({ where: { staffMemberId: owner.id } }), 0)
  assert.equal((await caller.onboarding.status()).locationComplete, true)
  await caller.onboarding.saveLocation(locationValues)
  assert.equal((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })).onboardingStep, "availability", "Retrying a location save succeeds without resetting progress")
  assert.equal(await prisma.location.count({ where: { organizationId } }), 1, "Retrying reuses the same location")
  assert.equal((await caller.onboarding.complete(details)).organizationId, result.organizationId)
  assert.equal((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })).onboardingStep, "availability", "Business retries preserve later progress")
  assert.equal(await prisma.staffMember.count({ where: { organizationId } }), 1)
  assert.equal(await prisma.location.count({ where: { organizationId } }), 1)
  let schedule = await caller.onboarding.schedule()
  await assert.rejects(caller.onboarding.confirmHolidays(schedule), { code: "CONFLICT" })
  const workingHours = [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020, isActive: true, timezone: details.timezone }]
  await caller.onboarding.saveAvailability({ workingHours, breaks: [] })
  await caller.onboarding.saveAvailability({ workingHours, breaks: [] })
  assert.equal(await prisma.availabilityRule.count({ where: { organizationId, staffMemberId: null, isBreak: false } }), workingHours.length, "Opening hours retries do not duplicate rules")
  await caller.onboarding.saveLocation({ ...locationValues, addressLine2: "2. kerros" })
  assert.equal((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })).onboardingStep, "holidays", "Revisiting location does not reset holiday progress")
  assert.equal((await caller.onboarding.status()).availabilityComplete, true)
  assert.equal((await caller.onboarding.status()).holidaysComplete, false)
  schedule = await caller.onboarding.schedule()
  assert.equal(schedule.workingHours[0].startMinute, 540)
  const holidays = schedule.holidays.map((holiday) => ({ ...holiday, enabled: holiday.id === "christmas" }))
  await caller.onboarding.confirmHolidays({ ...schedule, holidays })
  assert.equal((await caller.onboarding.status()).setupComplete, true)
  assert.equal((await caller.onboarding.status()).holidaysComplete, true)
  await caller.onboarding.confirmHolidays({ ...schedule, holidays })
  const savedSettings = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })
  await caller.onboarding.saveLocation(locationValues)
  assert.equal((await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })).onboardingStep, null, "Editing a location after setup does not reopen onboarding")
  assert.equal(await prisma.location.count({ where: { organizationId } }), 1)
  assert.equal(savedSettings.onboardingStep, null)
  assert.ok(savedSettings.businessHolidays)

  const exception = { id: "exception-onboarding-revisit", name: "Special day", date: "2027-07-14", enabled: true, closed: true, startMinute: 540, endMinute: 1020 }
  await caller.organizations.saveBusinessException(exception)
  await caller.onboarding.complete(details)
  await caller.onboarding.saveAvailability({ workingHours, breaks: [] })
  await caller.onboarding.confirmHolidays({ ...schedule, holidays })
  const revisited = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId } })
  assert.equal(revisited.onboardingStep, null, "Revisiting all completed steps never reopens onboarding")
  assert.deepEqual((revisited.businessHolidays as { exceptions: unknown[] }).exceptions, [exception], "Holiday retries preserve one-off special hours")
  assert.equal(await prisma.location.count({ where: { organizationId } }), 1)
  assert.equal(await prisma.staffMember.count({ where: { organizationId } }), 1)
  const concurrent = await Promise.all([caller.onboarding.complete(details), caller.onboarding.complete(details)])
  assert.ok(concurrent.every((entry) => entry.organizationId === result.organizationId))
  await Promise.all([caller.onboarding.saveAvailability({ workingHours, breaks: [] }), caller.onboarding.saveAvailability({ workingHours, breaks: [] })])
  assert.equal(await prisma.availabilityRule.count({ where: { organizationId, staffMemberId: null, isBreak: false } }), workingHours.length, "Concurrent retries are serialized without duplicate rules")

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
  await assert.rejects(caller.onboarding.location(), { code: "FORBIDDEN" })
  await assert.rejects(caller.onboarding.saveLocation(locationValues), { code: "FORBIDDEN" })
  await assert.rejects(caller.onboarding.saveAvailability({ workingHours, breaks: [] }), { code: "FORBIDDEN" })
  await assert.rejects(caller.onboarding.confirmHolidays(schedule), { code: "FORBIDDEN" })
  console.info("PASS onboarding retries, concurrent creation and saves, preserved progress and special hours, one location, owner profile, saved steps, holiday confirmation, validation, permissions, inherited and custom schedules, reset and later default changes")
} finally {
  auth.api.createOrganization = originalCreateOrganization
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
