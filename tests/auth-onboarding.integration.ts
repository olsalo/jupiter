import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
process.env.STRIPE_SECRET_KEY = ""
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "false"
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/auth-onboarding",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { createTRPCContext } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
const suffix = randomUUID()
const email = `auth-onboarding-${suffix}@example.invalid`
const headers = new Headers({ origin: "http://localhost:5175", host: "localhost:5175" })
let userId: string | undefined
const organizations: string[] = []
const caller = async () => appRouter.createCaller(await createTRPCContext({ headers }))

try {
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" }, headers })
  await assert.rejects(auth.api.signInEmailOTP({ headers, body: { email, otp: "invalid" } }))
  const signedIn = await auth.api.signInEmailOTP({ headers, body: { email, otp }, returnHeaders: true })
  userId = signedIn.response.user.id
  headers.set("cookie", signedIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "))
  assert.equal((await auth.api.getSession({ headers }))?.user.emailVerified, true)
  assert.equal((await (await caller()).onboarding.status()).businessComplete, false)
  const details = { businessName: `Login test ${suffix}`, name: "Matti Meikäläinen", location: "fi", currency: "EUR", timezone: "Europe/Helsinki" }
  const first = await (await caller()).onboarding.complete(details)
  organizations.push(first.organizationId)
  const session = await auth.api.getSession({ headers })
  assert.equal(session?.session.activeOrganizationId, first.organizationId)
  assert.equal((await (await caller()).onboarding.status()).businessComplete, true)
  assert.equal((await (await caller()).onboarding.business()).businessName, details.businessName)
  assert.equal((await (await caller()).onboarding.complete(details)).organizationId, first.organizationId)
  assert.equal(await prisma.staffMember.count({ where: { organizationId: first.organizationId } }), 1, "Business retries reuse the owner profile")

  const second = await prisma.organization.create({ data: {
    name: `Second ${suffix}`, slug: `auth-second-${suffix}`, createdAt: new Date(),
    members: { create: { userId, role: "member", createdAt: new Date() } },
  } })
  organizations.push(second.id)
  await (await caller()).organizations.setActive({ organizationId: second.id })
  assert.equal((await (await caller()).onboarding.status()).businessComplete, false)
  assert.equal((await (await caller()).onboarding.business()).businessName, second.name)
  assert.equal((await (await caller()).onboarding.subscription()).organizationId, second.id)
  await assert.rejects((await caller()).onboarding.complete(details), { code: "FORBIDDEN" })
  assert.equal(await prisma.organizationSettings.findUnique({ where: { organizationId: second.id } }), null)
  await prisma.member.updateMany({ where: { organizationId: second.id, userId }, data: { role: "owner" } })
  await (await caller()).onboarding.complete({ ...details, businessName: `Updated ${suffix}` })
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: second.id } })).name, `Updated ${suffix}`)
  assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: first.organizationId } })).name, details.businessName)
  assert.equal((await (await caller()).onboarding.status()).businessComplete, true)
  await auth.api.signOut({ headers })
  assert.equal(await auth.api.getSession({ headers }), null)
  await assert.rejects((await caller()).onboarding.status(), { code: "UNAUTHORIZED" })
  console.info("PASS OTP sign-in, new business setup, active organization selection, setup permissions, business isolation, repeat setup retries, and sign-out")
} finally {
  try {
    if (userId) {
      const created = await prisma.organization.findMany({ where: { members: { some: { userId } } }, select: { id: true } })
      const ids = [...new Set([...organizations, ...created.map(({ id }) => id)])]
      await prisma.organization.deleteMany({ where: { id: { in: ids } } })
      await prisma.user.deleteMany({ where: { id: userId } })
    }
    await prisma.verification.deleteMany({ where: { identifier: { contains: email } } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
