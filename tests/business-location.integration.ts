import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/business-location", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const orgIds: string[] = []
let userId: string | undefined
try {
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Business location test", email: `location-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const org = await prisma.organization.create({ data: { name: "Business location test", slug: `location-${suffix}`, createdAt: new Date(), settings: { create: { countryCode: "FI" } }, members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  orgIds.push(org.id)
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: org.id, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId: org.id, formatPreference: "eu", formatLocale: "fi-FI", locale: "en" })
  const initial = await caller.location.businessDetails()
  assert.equal(initial.id, null)
  assert.equal(initial.name, org.name)
  assert.equal(initial.country, "FI")
  const input = { ...initial, name: "Helsingin toimipaikka", addressLine1: "Mannerheimintie 1", addressLine2: "2. kerros", city: "Helsinki", postalCode: "00100", phone: "+358 40 123 4567", email: " info@example.invalid " }
  const created = await caller.location.saveBusinessDetails(input)
  assert.ok(created.id)
  assert.equal(created.email, "info@example.invalid")
  assert.deepEqual(await caller.location.businessDetails(), created)
  const repeated = await caller.location.saveBusinessDetails({ ...input, addressLine2: "" })
  assert.equal(repeated.id, created.id, "A second first-save request reuses the same location")
  assert.equal((await caller.location.list()).length, 1)
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: created.id } })).addressLine2, null)
  const updated = await caller.location.saveBusinessDetails({ ...created, city: "Espoo", email: "" })
  assert.equal((await caller.location.businessDetails()).city, "Espoo")
  assert.equal((await prisma.location.findUniqueOrThrow({ where: { id: created.id } })).email, null)
  const other = await caller.location.create({ name: "Toinen toimipaikka", slug: "second", city: "Tampere" })
  await caller.organizations.updateSettings({ defaultLocationId: other.id })
  assert.equal((await caller.location.businessDetails()).id, other.id, "An existing default location is preferred")
  const foreign = await prisma.organization.create({ data: { name: "Foreign location", slug: `foreign-location-${suffix}`, createdAt: new Date() } })
  orgIds.push(foreign.id)
  const foreignLocation = await prisma.location.create({ data: { organizationId: foreign.id, name: "Foreign", slug: "foreign" } })
  await assert.rejects(caller.location.saveBusinessDetails({ ...updated, id: foreignLocation.id }), { code: "NOT_FOUND" })
  await assert.rejects(caller.location.saveBusinessDetails({ ...updated, email: "invalid" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.location.saveBusinessDetails({ ...updated, name: " " }), { code: "BAD_REQUEST" })
  await prisma.member.updateMany({ where: { organizationId: org.id, userId }, data: { role: "member" } })
  await assert.rejects(caller.location.saveBusinessDetails(updated), { code: "FORBIDDEN" })
  console.info("PASS business location defaults, create, update, repeated saves, primary selection, validation and organization permissions")
} finally {
  if (orgIds.length) await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
