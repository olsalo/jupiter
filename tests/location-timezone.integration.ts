import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.STRIPE_SECRET_KEY = ""
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/location-timezone",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { getPrimaryLocation } = await vite.ssrLoadModule("/app/lib/locations/primary-location.ts") as typeof import("../app/lib/locations/primary-location")
const organizationIds: string[] = []
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Timezone test", email: `timezone-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const organization = await prisma.organization.create({ data: {
    name: "Timezone test", slug: `timezone-${suffix}`, createdAt: new Date(),
    settings: { create: { timezone: "UTC", currency: "EUR", countryCode: "FI" } },
    members: { create: { userId, role: "owner", createdAt: new Date() } },
  } })
  organizationIds.push(organization.id)
  const foreign = await prisma.organization.create({ data: { name: "Other business", slug: `other-timezone-${suffix}`, createdAt: new Date() } })
  organizationIds.push(foreign.id)
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: organization.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId: organization.id, formatPreference: "eu", formatLocale: "fi-FI", locale: "en" })
  const first = await caller.location.create({ name: "First location", slug: "first" })
  assert.equal(first.timezone, "UTC", "New locations inherit the business timezone")
  const second = await caller.location.create({ name: "Second location", slug: "second", timezone: "Europe/London" })
  const archived = await prisma.location.create({ data: { organizationId: organization.id, name: "Archived", timezone: "Asia/Tokyo", isActive: false } })
  const otherLocation = await prisma.location.create({ data: { organizationId: foreign.id, name: "Other", timezone: "Asia/Tokyo" } })
  const hours = await prisma.availabilityRule.create({ data: { organizationId: organization.id, dayOfWeek: 1, startMinute: 540, endMinute: 1020, timezone: "UTC" } })
  const datedHours = await prisma.availabilityRule.create({ data: { organizationId: organization.id, dayOfWeek: 1, startMinute: 540, endMinute: 1020, timezone: "UTC", validFrom: new Date("2027-03-10T00:00:00Z"), validUntil: new Date("2027-03-20T00:00:00Z") } })
  const separateHours = await prisma.availabilityRule.create({ data: { organizationId: organization.id, locationId: second.id, dayOfWeek: 1, startMinute: 540, endMinute: 1020, timezone: "Europe/London" } })

  await caller.organizations.updateGeneral({ businessName: organization.name, currency: "EUR", location: "fi", timezone: "America/New_York" })
  assert.equal((await caller.organizations.getCurrent()).settings?.timezone, "America/New_York")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: first.id } })).timezone, "UTC", "Business timezone changes do not alter the location timezone")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: second.id } })).timezone, "Europe/London", "Another location keeps its independent timezone")
  const updatedHours = await prisma.availabilityRule.findUniqueOrThrow({ where: { id: hours.id } })
  assert.equal(updatedHours.timezone, "UTC", "Location working hours retain their timezone")
  assert.equal(updatedHours.startMinute, 540)
  assert.equal(updatedHours.endMinute, 1020)
  const dated = await prisma.availabilityRule.findUniqueOrThrow({ where: { id: datedHours.id } })
  assert.equal(dated.validFrom?.toISOString(), "2027-03-10T00:00:00.000Z", "Business timezone changes leave dated location hours unchanged")
  assert.equal(dated.validUntil?.toISOString(), "2027-03-20T00:00:00.000Z", "Business timezone changes leave schedule end dates unchanged")

  await caller.organizations.updateSettings({ defaultLocationId: second.id, timezone: "Europe/Helsinki" })
  assert.equal((await caller.organizations.getCurrent()).settings?.timezone, "Europe/Helsinki")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: second.id } })).timezone, "Europe/London", "The default location keeps its timezone when business settings change")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: first.id } })).timezone, "UTC", "Business timezone changes do not alter the location timezone")
  assert.equal((await prisma.availabilityRule.findUniqueOrThrow({ where: { id: separateHours.id } })).timezone, "Europe/London")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: archived.id } })).timezone, "Asia/Tokyo")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: otherLocation.id } })).timezone, "Asia/Tokyo", "Timezone changes are scoped to the current business")

  await caller.location.update({ id: second.id, timezone: "Asia/Tokyo" })
  const locations = await caller.location.list()
  const settings = (await caller.organizations.getCurrent()).settings
  assert.equal(getPrimaryLocation(locations, settings?.defaultLocationId)?.timezone, "Asia/Tokyo", "Calendar timezone comes from the location even when it differs from the business")
  await caller.organizations.updateGeneral({ businessName: "Renamed business", currency: "EUR", location: "fi", timezone: "Europe/Helsinki" })
  assert.equal((await caller.organizations.getCurrent()).settings?.timezone, "Europe/Helsinki", "Saving other business settings preserves the business timezone")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: second.id } })).timezone, "Asia/Tokyo", "Saving general settings does not alter the location timezone")
  await assert.rejects(caller.organizations.updateGeneral({ businessName: "Rejected", currency: "EUR", location: "fi", timezone: "Invalid/Timezone" }), { code: "BAD_REQUEST" })
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: second.id } })).timezone, "Asia/Tokyo", "Invalid settings do not change the location")

  await prisma.location.updateMany({ where: { organizationId: organization.id }, data: { isActive: false } })
  const created = await caller.location.saveBusinessDetails({ id: null, name: "New office", addressLine1: "", addressLine2: "", postalCode: "", city: "", country: "FI", phone: "", email: "" })
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: created.id } })).timezone, "Europe/Helsinki", "Locations created through business details also inherit the timezone")
  console.info("PASS location timezone inheritance, independent business settings changes, unchanged local working hours, default selection, independent locations, tenant isolation and invalid inputs")
} finally {
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
