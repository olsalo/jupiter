import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/resource-limits", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { createResourceLimits } = await vite.ssrLoadModule("/app/.server/resource-limits/service.ts") as typeof import("../app/.server/resource-limits/service")
const { createTRPCContext } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
const { ResourceLimitError } = await vite.ssrLoadModule("/app/.server/resource-limits/errors.ts") as typeof import("../app/.server/resource-limits/errors")
const suffix = randomUUID()
const emails = ["owner", "recipient"].map((name) => `limits-${name}-${suffix}@example.invalid`)
const orgIds: string[] = []
const origin = "http://localhost:5175"
async function signIn(email: string) {
  const headers = new Headers({ origin, host: "localhost:5175" })
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" }, headers })
  const result = await auth.api.signInEmailOTP({ headers, body: { email, otp }, returnHeaders: true })
  headers.set("cookie", result.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "))
  return { headers, user: result.response.user }
}
async function caller(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  return appRouter.createCaller({ headers, request: undefined, prisma, user: session?.user, session: session?.session, organizationId: session?.session.activeOrganizationId ?? null, formatLocale: "fi-FI", formatPreference: "eu", locale: "en" })
}
try {
  const [owner, recipient] = await Promise.all(emails.map(signIn))
  const org = await prisma.organization.create({ data: { name: "Limits test", slug: `limits-${suffix}`, createdAt: new Date(), members: { create: { userId: owner.user.id, role: "owner", createdAt: new Date() } } } })
  orgIds.push(org.id)
  await prisma.session.updateMany({ where: { userId: owner.user.id }, data: { activeOrganizationId: org.id } })
  const admin = await caller(owner.headers)
  const limits = createResourceLimits(prisma)
  assert.deepEqual(await admin.resourceLimits.getAll(), { teamMembers: { used: 1, limit: 10, remaining: 9, reached: false } })
  await limits.assert(org.id, "teamMembers")
  const invited = await admin.team.addPerson({ name: "Recipient", email: recipient.user.email, takesAppointments: true, giveAppAccess: true, sendEmail: false })
  assert.equal((await limits.get(org.id, "teamMembers")).used, 2, "A staff profile with an invitation counts once")
  const ownerProfile = await admin.team.addPerson({ name: "Owner", email: owner.user.email, takesAppointments: true, giveAppAccess: false })
  assert.ok(ownerProfile.personId)
  assert.equal((await limits.get(org.id, "teamMembers")).used, 2, "A linked account and profile count once")
  for (let index = 0; index < 7; index++) await admin.team.addPerson({ name: `Staff ${index}`, takesAppointments: true, giveAppAccess: false })
  const racing = await Promise.allSettled([0, 1].map((index) => admin.team.addPerson({ name: `Last place ${index}`, takesAppointments: true, giveAppAccess: false })))
  assert.equal(racing.filter((result) => result.status === "fulfilled").length, 1, "Concurrent staff creations share the existing organization lock")
  assert.deepEqual(await limits.get(org.id, "teamMembers"), { used: 10, limit: 10, remaining: 0, reached: true })
  await assert.rejects(limits.assert(org.id, "teamMembers"), ResourceLimitError)
  await assert.rejects(admin.team.addPerson({ name: "Over limit", takesAppointments: true, giveAppAccess: false }), (error: unknown) => error instanceof Error && "code" in error && error.code === "FORBIDDEN" && "cause" in error && error.cause instanceof ResourceLimitError)
  await assert.rejects(admin.team.invite({ name: "Over limit", email: `extra-${suffix}@example.invalid`, sendEmail: false }), { code: "FORBIDDEN" })
  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`${origin}/trpc/team.addPerson`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: { name: "HTTP overflow", takesAppointments: true, giveAppAccess: false } }) }),
    router: appRouter,
    createContext: () => createTRPCContext({ headers: owner.headers }),
  })
  const body = await response.json()
  assert.equal(response.status, 403)
  assert.equal(body.error.json.data.appCode, "RESOURCE_LIMIT_REACHED")
  assert.deepEqual(body.error.json.data.resourceLimit, { resource: "teamMembers", limit: 10 })
  await assert.rejects(admin.staff.create({ name: "Bypass" }), { code: "FORBIDDEN" })
  await assert.rejects(auth.api.createInvitation({ headers: owner.headers, body: { email: `direct-${suffix}@example.invalid`, organizationId: org.id, role: "member" } }))
  const joined = await caller(recipient.headers)
  assert.equal((await joined.team.acceptInvitation({ invitationId: invited.invitationId! })).error, null, "Reserved invitation can be accepted at capacity")
  assert.equal((await limits.get(org.id, "teamMembers")).used, 10)
  await assert.rejects((await caller(recipient.headers)).resourceLimits.getAll(), { code: "FORBIDDEN" })
  await assert.rejects((await caller(new Headers())).resourceLimits.getAll(), { code: "UNAUTHORIZED" })
  const overflow = await prisma.staffMember.create({ data: { organizationId: org.id, name: "Legacy overflow" } })
  assert.deepEqual(await limits.get(org.id, "teamMembers"), { used: 11, limit: 10, remaining: 0, reached: true })
  await assert.rejects(limits.assert(org.id, "teamMembers"), ResourceLimitError)
  await prisma.staffMember.delete({ where: { id: overflow.id } })
  const available = await prisma.staffMember.findFirstOrThrow({ where: { organizationId: org.id, name: "Staff 0" } })
  await prisma.staffMember.delete({ where: { id: available.id } })
  const standalone = await admin.team.invite({ name: "Reserved", email: `reserved-${suffix}@example.invalid`, sendEmail: false })
  assert.equal((await limits.get(org.id, "teamMembers")).used, 10)
  await admin.team.cancelInvitation({ invitationId: standalone.id! })
  assert.equal((await limits.get(org.id, "teamMembers")).remaining, 1, "Cancelling a standalone invitation releases its place")
  console.info("PASS plan usage, limit boundaries, deduplication, concurrency, invitation acceptance, cancellation and permissions")
} finally {
  try {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
    await prisma.verification.deleteMany({ where: { OR: emails.map((email) => ({ identifier: { contains: email } })) } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
