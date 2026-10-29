import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"
import { S3Client } from "@aws-sdk/client-s3"
import sharp from "sharp"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/admin-booking-page", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const orgIds: string[] = []
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Admin booking page test", email: `booking-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const org = await prisma.organization.create({ data: { name: "Admin booking page test", slug: `booking-${suffix}`, createdAt: new Date(), settings: { create: { countryCode: "FI" } }, members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  orgIds.push(org.id)
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId: org.id, formatPreference: "eu", formatLocale: "fi-FI", locale: "en" })
  await caller.bookingPage.updateImage({ imageKey: null })
  assert.equal(await prisma.bookingPage.count({ where: { organizationId: org.id } }), 1, "The image control can create the default page before the main form is saved")
  const defaults = await caller.bookingPage.get()
  assert.equal(defaults.values.imageKey, null)
  assert.equal(defaults.values.title, "")
  assert.equal(defaults.values.accentColor, null)
  assert.equal(defaults.published, true)
  const staff = await prisma.staffMember.create({ data: { organizationId: org.id, name: "Tekijä" } })
  const services = await Promise.all(["Ensimmäinen", "Toinen"].map((name, index) => prisma.service.create({ data: { organizationId: org.id, name, slug: `service-${index}`, durationMinutes: 30, staffServices: { create: { staffMemberId: staff.id } } } })))
  const location = await prisma.location.create({ data: { organizationId: org.id, name: "Helsinki", slug: "helsinki" } })
  const input = { ...defaults.values, accentColor: "#facc15", slug: "varaa-aika", title: "Varaa aika", description: "Tervetuloa", successMessage: "Nähdään pian", serviceIds: services.map((service) => service.id).reverse(), staffIds: [staff.id], defaultLocationId: location.id, allowStaffSelection: false, allowLocationSelection: false }
  await caller.bookingPage.updateSwitches({ allowStaffSelection: false })
  const { isActive: _active, allowStaffSelection: _staffSelection, imageKey: _imageKey, ...formInput } = input
  assert.deepEqual(await caller.bookingPage.save(formInput), formInput)
  assert.deepEqual((await caller.bookingPage.get()).values, input)
  assert.equal(await prisma.bookingPage.count({ where: { organizationId: org.id } }), 1)
  const settings = await prisma.organizationSettings.findUniqueOrThrow({ where: { organizationId: org.id } })
  assert.ok(settings.defaultBookingPageId)
  const page = await caller.booking.getPage({ organizationSlug: org.slug })
  assert.equal(page.page?.slug, input.slug)
  assert.equal(page.page?.accentColor, input.accentColor)
  assert.equal(page.page?.imageUrl, null)
  assert.deepEqual(page.openingHours, [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 480, endMinute: 1080 })), "Opening hours fall back to the business defaults")
  const baseHours = { organizationId: org.id, timezone: "Europe/Helsinki", dayOfWeek: 1, startMinute: 540, endMinute: 1020 }
  const businessHours = await prisma.availabilityRule.create({ data: baseHours })
  await prisma.availabilityRule.createMany({ data: [
    { ...baseHours, staffMemberId: staff.id, startMinute: 600 },
    { ...baseHours, locationId: location.id, startMinute: 600 },
    { ...baseHours, isBreak: true, startMinute: 720, endMinute: 780 },
    { ...baseHours, dayOfWeek: 2, validFrom: new Date(Date.now() + 86400000) },
    { ...baseHours, dayOfWeek: 3, validUntil: new Date(Date.now() - 86400000) },
  ] })
  assert.deepEqual((await caller.booking.getPage({ organizationSlug: org.slug })).openingHours, [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020 }], "Public hours expose only current business hours, excluding staff, location, breaks and scheduled changes")
  await prisma.availabilityRule.update({ where: { id: businessHours.id }, data: { isActive: false } })
  assert.deepEqual((await caller.booking.getPage({ organizationSlug: org.slug })).openingHours, [], "An explicitly closed business never falls back to default hours")

  const originalSend = S3Client.prototype.send
  const storageEnv = { S3_ENDPOINT: process.env.S3_ENDPOINT, S3_BUCKET: process.env.S3_BUCKET, S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY }
  try {
    Object.assign(process.env, { S3_ENDPOINT: "http://127.0.0.1:9000", S3_BUCKET: "test", S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test" })
    const deleted: string[] = []
    let failDeletion = false
    const mockSend = async (command: { constructor: { name: string }; input: { Key?: string } }) => {
      if (command.constructor.name === "DeleteObjectCommand") {
        const page = await prisma.bookingPage.findUniqueOrThrow({ where: { id: settings.defaultBookingPageId! } })
        assert.notEqual((page.metadata as { imageKey: string | null }).imageKey, command.input.Key, "Database changes commit before the old object is deleted")
        if (failDeletion) throw new Error("Storage deletion unavailable")
        deleted.push(command.input.Key!)
      }
      return {}
    }
    S3Client.prototype.send = mockSend as typeof originalSend
    const source = await sharp({ create: { width: 100, height: 50, channels: 3, background: "#ffffff" } }).png().toBuffer()
    const uploaded = await caller.bookingPage.uploadImage({ base64: source.toString("base64") })
    const beforeImage = (await caller.bookingPage.get()).values
    await caller.bookingPage.updateImage({ imageKey: uploaded.key })
    assert.deepEqual((await caller.bookingPage.get()).values, { ...beforeImage, imageKey: uploaded.key }, "Immediate image saves preserve all main-form fields and switches")
    await caller.bookingPage.save(formInput)
    assert.equal((await caller.bookingPage.get()).values.imageKey, uploaded.key, "Saving other fields cannot overwrite an immediately saved image")
    await caller.bookingPage.updateImage({ imageKey: uploaded.key })
    assert.deepEqual(deleted, [], "Re-saving the same key must not delete the image")
    assert.match((await caller.booking.getPage({ organizationSlug: org.slug })).page!.imageUrl!, /^\/api\/booking-image\//)
    assert.ok(new URL(await caller.booking.getImage({ organizationSlug: org.slug })).searchParams.get("X-Amz-Signature"))
    await assert.rejects(caller.bookingPage.updateImage({ imageKey: "booking-pages/other-org/image.avif" }), { code: "BAD_REQUEST" })
    S3Client.prototype.send = (async () => { throw new Error("Storage unavailable") }) as typeof originalSend
    await assert.rejects(caller.bookingPage.updateImage({ imageKey: uploaded.key }))
    assert.equal((await caller.bookingPage.get()).values.imageKey, uploaded.key, "A failed image update preserves the saved image")
    assert.deepEqual(deleted, [], "Invalid or failed saves never delete the live image")
    S3Client.prototype.send = mockSend as typeof originalSend
    const replacement = await caller.bookingPage.uploadImage({ base64: source.toString("base64") })
    const replaced = await caller.bookingPage.updateImage({ imageKey: replacement.key })
    assert.equal(replaced.cleanupPending, false)
    assert.deepEqual(deleted, [uploaded.key], "Replacing an image deletes the old object")
    assert.equal((await caller.bookingPage.get()).values.imageKey, replacement.key)
    failDeletion = true
    const removed = await caller.bookingPage.updateImage({ imageKey: null })
    assert.equal(removed.cleanupPending, true, "Failed storage deletion is reported after the page is updated")
    assert.equal((await caller.bookingPage.get()).values.imageKey, null)
    const pending = await prisma.bookingPage.findUniqueOrThrow({ where: { id: settings.defaultBookingPageId! } })
    assert.deepEqual((pending.metadata as { pendingImageDeletionKeys: string[] }).pendingImageDeletionKeys, [replacement.key])
    failDeletion = false
    const retried = await caller.bookingPage.updateImage({ imageKey: null })
    assert.equal(retried.cleanupPending, false)
    assert.deepEqual(deleted, [uploaded.key, replacement.key], "Removing an image retries pending object deletion")
    const cleaned = await prisma.bookingPage.findUniqueOrThrow({ where: { id: settings.defaultBookingPageId! } })
    assert.deepEqual((cleaned.metadata as { pendingImageDeletionKeys: string[] }).pendingImageDeletionKeys, [])
    await caller.bookingPage.save(input)
    assert.equal((await caller.booking.getPage({ organizationSlug: org.slug })).page?.imageUrl, null)
    await assert.rejects(caller.booking.getImage({ organizationSlug: org.slug }), { code: "NOT_FOUND" })
  } finally {
    S3Client.prototype.send = originalSend
    for (const [key, value] of Object.entries(storageEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
  await assert.rejects(caller.bookingPage.save({ ...formInput, accentColor: "red" }), { code: "BAD_REQUEST" })
  await caller.bookingPage.save({ ...formInput, accentColor: null })
  assert.equal((await caller.booking.getPage({ organizationSlug: org.slug })).page?.accentColor, null)
  await caller.bookingPage.save(formInput)
  assert.equal((await caller.bookingPage.get()).publicPath, `/book/${org.slug}/${input.slug}`)
  assert.equal((await caller.booking.getPage({ organizationSlug: org.slug, bookingPageSlug: input.slug })).page?.title, input.title)
  await caller.bookingPage.save({ ...input, slug: "uusi-osoite" })
  assert.equal((await caller.booking.getPage({ organizationSlug: org.slug, bookingPageSlug: "uusi-osoite" })).page?.slug, "uusi-osoite")
  await assert.rejects(caller.booking.getPage({ organizationSlug: org.slug, bookingPageSlug: input.slug }), { code: "NOT_FOUND" })
  await caller.bookingPage.save(input)
  const reserved = await prisma.bookingPage.create({ data: { organizationId: org.id, slug: "reserved", name: "Other page" } })
  await assert.rejects(caller.bookingPage.save({ ...input, slug: "reserved" }), { code: "BAD_REQUEST" })
  await prisma.bookingPage.delete({ where: { id: reserved.id } })
  assert.equal(page.page?.title, input.title)
  assert.equal(page.page?.successMessage, input.successMessage)
  assert.deepEqual(page.services.map((service) => service.id), input.serviceIds)
  assert.deepEqual(page.staff.map((person) => person.id), input.staffIds)
  await caller.bookingPage.save({ ...formInput, serviceIds: [input.serviceIds[0]] })
  const restricted = await caller.bookingPage.get()
  assert.deepEqual(restricted.values.serviceIds, input.serviceIds, "The editor lists previously excluded services too")
  assert.deepEqual(restricted.values.hiddenServiceIds, input.serviceIds.slice(1), "Previously excluded services remain hidden")
  await prisma.bookingPage.update({ where: { id: settings.defaultBookingPageId! }, data: { metadata: { customSetting: "preserved" } } })
  await caller.bookingPage.save({ ...formInput, hiddenServiceIds: [input.serviceIds[0]] })
  const partiallyHidden = await caller.bookingPage.get()
  assert.deepEqual(partiallyHidden.values.serviceIds, input.serviceIds, "Hidden services remain in their saved list order")
  assert.deepEqual(partiallyHidden.values.hiddenServiceIds, [input.serviceIds[0]])
  assert.equal(((await prisma.bookingPage.findUniqueOrThrow({ where: { id: settings.defaultBookingPageId! } })).metadata as { customSetting: string }).customSetting, "preserved", "Visibility updates preserve other booking page settings")
  assert.deepEqual((await caller.booking.getPage({ organizationSlug: org.slug })).services.map((service) => service.id), input.serviceIds.slice(1))
  await assert.rejects(caller.booking.getAvailableSlots({ organizationSlug: org.slug, serviceId: input.serviceIds[0], from: new Date("2026-11-01T00:00:00Z"), to: new Date("2026-11-02T00:00:00Z") }), { code: "NOT_FOUND" })
  await caller.bookingPage.save({ ...formInput, hiddenServiceIds: input.serviceIds })
  assert.deepEqual((await caller.bookingPage.get()).values.hiddenServiceIds, input.serviceIds)
  assert.equal((await caller.booking.getPage({ organizationSlug: org.slug })).services.length, 0, "Hiding every service must not show all services")
  await caller.bookingPage.save({ ...formInput, serviceIds: [...input.serviceIds].reverse(), hiddenServiceIds: [input.serviceIds[0]] })
  assert.deepEqual((await caller.bookingPage.get()).values.serviceIds, [...input.serviceIds].reverse(), "Ordering includes hidden services")
  await caller.bookingPage.save(formInput)
  assert.deepEqual((await caller.booking.getPage({ organizationSlug: org.slug })).services.map((service) => service.id), input.serviceIds, "Showing services restores their public order")
  await caller.bookingPage.updateSwitches({ isActive: false })
  await caller.bookingPage.save(input)
  assert.equal((await caller.bookingPage.get()).values.isActive, false, "Saving form fields cannot overwrite an immediately saved switch")
  assert.equal((await caller.bookingPage.get()).published, false)
  await assert.rejects(caller.booking.getPage({ organizationSlug: org.slug }), { code: "NOT_FOUND" })
  await caller.bookingPage.updateSwitches({ isActive: true })
  await caller.bookingPage.save(input)
  assert.equal(await prisma.bookingPage.count({ where: { organizationId: org.id } }), 1)
  const foreign = await prisma.organization.create({ data: { name: "Other business", slug: `foreign-${suffix}`, createdAt: new Date() } })
  orgIds.push(foreign.id)
  const foreignStaff = await prisma.staffMember.create({ data: { organizationId: foreign.id, name: "Other staff" } })
  const foreignService = await prisma.service.create({ data: { organizationId: foreign.id, name: "Other service", slug: "other", durationMinutes: 30 } })
  const foreignLocation = await prisma.location.create({ data: { organizationId: foreign.id, name: "Other place", slug: "other" } })
  for (const override of [{ hiddenServiceIds: [foreignService.id] },{ serviceIds: [foreignService.id] }, { staffIds: [foreignStaff.id] }, { defaultLocationId: foreignLocation.id }, { title: "a".repeat(121) }, { slug: "" }, { slug: "invalid url" }, { slug: "../other" }, { slug: "a".repeat(81) }]) {
    await assert.rejects(caller.bookingPage.save({ ...input, ...override }), { code: "BAD_REQUEST" })
  }
  assert.deepEqual((await caller.bookingPage.get()).values, input, "Invalid selections leave saved settings intact")
  await caller.bookingPage.save({ ...input, serviceIds: [], staffIds: [] })
  assert.equal((await caller.booking.getPage({ organizationSlug: org.slug })).services.length, 2, "Empty selections include all available services")
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "member" } })
  await assert.rejects(caller.bookingPage.updateSwitches({ isActive: false }), { code: "FORBIDDEN" })
  await assert.rejects(caller.bookingPage.get(), { code: "FORBIDDEN" })
  await assert.rejects(caller.bookingPage.uploadImage({ base64: "aGVsbG8=" }), { code: "FORBIDDEN" })
  await assert.rejects(caller.bookingPage.updateImage({ imageKey: null }), { code: "FORBIDDEN" })
  await assert.rejects(caller.bookingPage.save(input), { code: "FORBIDDEN" })
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "admin" } })
  await caller.bookingPage.save(input)
  const beforeSwitch = (await caller.bookingPage.get()).values
  await caller.bookingPage.updateSwitches({ allowStaffSelection: true })
  assert.deepEqual((await caller.bookingPage.get()).values, { ...beforeSwitch, allowStaffSelection: true }, "Switch updates preserve all other saved fields")
  await assert.rejects(caller.bookingPage.updateSwitches({}), { code: "BAD_REQUEST" })
  console.info("PASS admin booking page persistence, immediate image saves and removal, image save failures, custom URL routing, URL changes and conflicts, public ordering, per-service visibility, hidden-service booking restrictions, publish/unpublish, all-service defaults, validation, tenant isolation and permissions")
} finally {
  if (orgIds.length) await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
