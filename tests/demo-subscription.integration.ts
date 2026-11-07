import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "true"
process.env.STRIPE_SECRET_KEY = "sk_test_demo"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_demo"
process.env.STRIPE_SOLO_PRICE_ID = "price_solo"
process.env.STRIPE_TEAM_PRICE_ID = "price_team"
process.env.STRIPE_EXTRA_STAFF_PRICE_ID = "price_extra"
process.env.BETTER_AUTH_URL = "http://localhost:5175"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/demo-subscription", appType: "custom", resolve: { alias: { "~": appPath } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server")
  const { billingRouter } = await vite.ssrLoadModule("/app/.server/routers/billing.ts") as typeof import("../app/.server/routers/billing")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const { stripeClient } = await vite.ssrLoadModule("/app/lib/billing/stripe.server.ts") as typeof import("../app/lib/billing/stripe.server")
  const { hasActiveOrganizationSubscription } = await vite.ssrLoadModule("/app/lib/billing/billing.server.ts") as typeof import("../app/lib/billing/billing.server")
  const { createResourceLimits } = await vite.ssrLoadModule("/app/.server/resource-limits/service.ts") as typeof import("../app/.server/resource-limits/service")
  const router = createTRPCRouter(billingRouter)
  type Context = Parameters<typeof router.createCaller>[0]
  let role = "owner"
  let row: Record<string, unknown> | null = null
  let used = 1
  let stripeCalls = 0
  const database = {
    $queryRaw: async () => [],
    member: { findFirst: async () => ({ role }) },
    subscription: {
      findMany: async () => row ? [row] : [],
      findUnique: async () => row,
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => { row = row ? { ...row, ...update } : create; return row },
    },
    staffMember: { count: async () => used },
  }
  Object.assign(prisma, { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(database) })
  Object.assign(prisma.subscription, database.subscription)
  Object.assign(prisma.staffMember, database.staffMember)
  assert.ok(stripeClient)
  Object.assign(stripeClient.prices, { retrieve: async () => { stripeCalls++; throw new Error("Stripe checkout selected") } })
  const context = { prisma: database, user: { id: "owner", name: "Owner", email: "owner@example.invalid" }, session: { activeOrganizationId: "org" }, organizationId: "org", headers: new Headers(), locale: "fi", formatPreference: "eu", formatLocale: "fi-FI" } as unknown as Context
  const caller = router.createCaller(context)
  const save = (planId: "solo" | "team", extraStaff = 0, origin = "http://localhost:5175") => caller.savePlan({ planId, extraStaff, interval: "month", returnUrl: `${origin}/#settings/billing`, cancelUrl: `${origin}/#settings/billing`, locale: "fi" })
  role = "member"
  await assert.rejects(save("solo"), { code: "FORBIDDEN" })
  role = "owner"
  assert.equal((await save("solo", 0, "http://127.0.0.1:5175")).url, null, "Demo activation works from another local origin without using return URLs")
  assert.equal((await caller.plan()).current?.planId, "solo")
  assert.equal((await createResourceLimits(database as never).get("org", "teamMembers")).limit, 1)
  await save("team", 2)
  assert.equal((await caller.plan()).current?.capacity, 5)
  assert.equal((await createResourceLimits(database as never).get("org", "teamMembers")).limit, 5)
  assert.equal(stripeCalls, 0, "Demo plans do not contact Stripe")
  used = 2
  await assert.rejects(save("solo"), (error: unknown) => {
    const failure = error as { code?: string; cause?: { capacityUsed?: number } }
    return failure.code === "BAD_REQUEST" && failure.cause?.capacityUsed === 2
  }, "Demo changes report the current count when capacity is too small")
  assert.equal((await caller.plan()).current?.capacity, 5)
  process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "false"
  assert.equal(await hasActiveOrganizationSubscription({ organizationId: "org", db: database as never }), false, "Demo subscriptions do not grant access when demo mode is off")
  await assert.rejects(save("team", 0, "http://127.0.0.1:5175"), { code: "BAD_REQUEST" }, "Stripe mode still rejects untrusted return origins")
  await assert.rejects(save("team"), /Stripe checkout selected/)
  assert.ok(stripeCalls > 0, "Turning demo mode off uses Stripe")
  process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "true"
  process.env.NODE_ENV = "production"
  assert.equal(await hasActiveOrganizationSubscription({ organizationId: "org", db: database as never }), false, "Production ignores demo subscriptions")
  assert.equal((await createResourceLimits(database as never).get("org", "teamMembers")).limit, 0)
  await assert.rejects(save("team"), /Stripe checkout selected/, "Production never uses demo activation")
  console.info("PASS selected demo plans, replacement, capacity, owner permissions, Stripe routing and production isolation")
} finally {
  await vite.close()
}
