import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
process.env.STRIPE_SECRET_KEY = ""
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/id-generation",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const { generateId } = await vite.ssrLoadModule("/app/lib/database/id.ts") as typeof import("../app/lib/database/id")
const { createIdWriteTransformer } = await vite.ssrLoadModule("/app/lib/database/prisma-ids.server.ts") as typeof import("../app/lib/database/prisma-ids.server.ts")
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const ids = new Set<string>()
const assertId = (id: string) => assert.match(id, /^[0-9a-zA-Z]{12}$/)
const email = `id-generation-${randomUUID()}@example.invalid`
let userId: string | undefined
let organizationId: string | undefined
try {
  for (let index = 0; index < 1000; index++) {
    const id = generateId()
    assertId(id)
    ids.add(id)
  }
  assert.equal(ids.size, 1000)
  const headers = new Headers({ origin: "http://localhost:5175", host: "localhost:5175" })
  const otp = await auth.api.createVerificationOTP({ headers, body: { email, type: "sign-in" } })
  const verification = await prisma.verification.findFirstOrThrow({ where: { identifier: { contains: email } } })
  assertId(verification.id)
  const signedIn = await auth.api.signInEmailOTP({ headers, body: { email, otp }, returnHeaders: true })
  userId = signedIn.response.user.id
  assertId(userId)
  const session = await prisma.session.findFirstOrThrow({ where: { userId } })
  assertId(session.id)
  headers.set("cookie", signedIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "))
  const organization = await auth.api.createOrganization({ headers, body: { name: "ID test", slug: `ids-${generateId().toLowerCase()}` } })
  assert.ok(organization)
  organizationId = organization.id
  assertId(organizationId)
  const member = await prisma.member.findFirstOrThrow({ where: { organizationId, userId } })
  assertId(member.id)
  headers.set("x-send-invitation-email", "false")
  const invitation = await auth.api.createInvitation({ headers, body: { organizationId, email: `invite-${email}`, role: "member" } })
  assertId(invitation.id)
  const account = await prisma.account.create({ data: { userId, providerId: "id-test", accountId: generateId() } })
  assertId(account.id)

  const staff = await prisma.staffMember.create({ data: {
    organizationId, name: "Nested staff",
    availabilityRules: { createMany: { data: [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020, timezone: "UTC", organizationId }] } },
  }, include: { availabilityRules: true } })
  assertId(staff.id)
  assertId(staff.availabilityRules[0].id)
  const bulk = await prisma.note.createManyAndReturn({ data: [
    { organizationId, title: "Bulk A", body: "A" },
    { organizationId, title: "Bulk B", body: "B" },
  ] })
  bulk.forEach((note) => assertId(note.id))
  await prisma.note.createMany({ data: { organizationId, title: "Single bulk", body: "C" } })
  const note = await prisma.note.findFirstOrThrow({ where: { organizationId, title: "Single bulk" } })
  assertId(note.id)
  const explicit = await prisma.note.create({ data: { id: "existing_prefixed_id", organizationId, title: "Explicit", body: "D" } })
  assert.equal(explicit.id, "existing_prefixed_id")
  await prisma.note.upsert({ where: { id: explicit.id }, create: { organizationId, title: "Unused", body: "E" }, update: { body: "Updated" } })
  assert.equal((await prisma.note.findUniqueOrThrow({ where: { id: explicit.id } })).id, explicit.id)
  const settings = await prisma.organizationSettings.upsert({ where: { organizationId }, create: { organizationId }, update: {} })
  assertId(settings.id)
  const nested = await prisma.organization.update({ where: { id: organizationId }, data: {
    notes: { create: { title: "Nested update", body: "F" } },
  }, include: { notes: true } })
  nested.notes.filter((item) => item.id !== explicit.id).forEach((item) => assertId(item.id))
  const txId = await prisma.$transaction(async (tx) => (await tx.service.create({ data: { organizationId: organizationId!, name: "Transaction service", slug: "transaction", durationMinutes: 30 } })).id)
  assertId(txId)

  const transformed = createIdWriteTransformer(prisma)("Organization", "update", { where: { id: organizationId }, data: {
    notes: {
      connectOrCreate: { where: { id: "saved-id" }, create: { title: "Connect", body: "G" } },
      upsert: [{ where: { id: "saved-id" }, create: { title: "Upsert", body: "H" }, update: { title: "Keep ID" } }],
    },
  } }) as { data: { notes: { connectOrCreate: { where: { id: string }; create: { id: string } }; upsert: { create: { id: string }; update: { id?: string } }[] } } }
  assert.equal(transformed.data.notes.connectOrCreate.where.id, "saved-id")
  assertId(transformed.data.notes.connectOrCreate.create.id)
  assertId(transformed.data.notes.upsert[0].create.id)
  assert.equal(transformed.data.notes.upsert[0].update.id, undefined)
  console.info("PASS unprefixed 12-character alphanumeric IDs: Better Auth verification/user/session/organization/member, account, nested and bulk writes, upserts, explicit IDs, updates and transactions")
} finally {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.verification.deleteMany({ where: { identifier: { contains: email } } })
  await prisma.$disconnect()
  await vite.close()
}
