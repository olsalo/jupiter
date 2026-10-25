import "dotenv/config"
import assert from "node:assert/strict"
import { RouterContextProvider, type RouterContext } from "react-router"
import { createServer } from "vite"

// Enable the subscription step without making Stripe or database requests.
process.env.NODE_ENV = "test"
const demoBypassEnabled = process.argv.includes("--demo")
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = String(demoBypassEnabled)
process.env.STRIPE_SECRET_KEY = "sk_test_onboarding_routing"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_onboarding_routing"
process.env.STRIPE_PRO_PRICE_ID = "price_onboarding_routing"
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/onboarding-routing",
  appType: "custom",
  resolve: { alias: {
    "@coss/ui/components": new URL("../app/components/ui", import.meta.url).pathname,
    "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname,
    "@": new URL("../app", import.meta.url).pathname,
    "~": new URL("../app", import.meta.url).pathname,
  } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { loader } = await vite.ssrLoadModule("/app/routes/onboarding/onboarding.tsx") as typeof import("../app/routes/onboarding/onboarding")
  const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
  const { sessionContext } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const { queryCacheOptions } = await vite.ssrLoadModule("/app/lib/query/query-cache.ts") as typeof import("../app/lib/query/query-cache")
  const originalGcTime = queryCacheOptions.gcTime
  queryCacheOptions.gcTime = Infinity
  type AuthSession = typeof sessionContext extends RouterContext<infer Value> ? Value : never
  const context = new RouterContextProvider()
  context.set(sessionContext, {
    user: { id: "onboarding-routing-user", name: "Matti Meikäläinen" },
    session: { activeOrganizationId: null },
  } as AuthSession)

  const originalFindMember = prisma.member.findFirst
  const originalFindSubscription = prisma.subscription.findFirst
  let businessComplete = true
  let subscriptionComplete = false
  let onboardingStep: string | null = null
  prisma.member.findFirst = (async () => ({
    organizationId: "onboarding-routing-org",
    organization: { settings: businessComplete ? { countryCode: "FI", timezone: "Europe/Helsinki", onboardingStep } : null },
  })) as unknown as typeof prisma.member.findFirst
  prisma.subscription.findFirst = (async () => subscriptionComplete ? { id: "onboarding-subscription" } : null) as typeof prisma.subscription.findFirst

  try {
    for (const search of ["", "?billing=year"]) {
      const result = await loader({
        request: new Request(`http://localhost:5174/onboarding/subscription.data${search}${search ? "&" : "?"}_routes=root%2Croutes%2Fonboarding%2Fonboarding`),
        url: new URL(`http://localhost:5174/onboarding/subscription${search}`),
        params: {},
        context,
        pattern: "/onboarding/subscription",
      })
      assert.equal(result.data.stepId, "subscription")
      assert.equal(result.data.step, 4)
    }

    await assert.rejects(() => loader({
      request: new Request("http://localhost:5174/onboarding.data?billing=year&_routes=root"),
      url: new URL("http://localhost:5174/onboarding?billing=year"),
      params: {},
      context,
      pattern: "/onboarding",
    }), (error: unknown) => (
      error instanceof Response &&
      error.status === 302 &&
      error.headers.get("Location") === "/onboarding/subscription?billing=year"
    ))

    const loadStep = (stepId: "business" | "subscription") => loader({
      request: new Request(`http://localhost:5174/onboarding/${stepId}.data?billing=year&step=2`),
      url: new URL(`http://localhost:5174/onboarding/${stepId}?billing=year&step=2`),
      params: {},
      context,
      pattern: `/onboarding/${stepId}`,
    })

    if (demoBypassEnabled) {
      for (const complete of [false, true]) {
        businessComplete = complete
        subscriptionComplete = complete
        for (const stepId of ["business", "subscription"] as const) {
          const result = await loadStep(stepId)
          assert.equal(result.data.stepId, stepId)
          assert.equal(result.data.step, stepId === "business" ? 1 : 4)
          assert.equal(result.data.totalSteps, 4)
          assert.equal(result.data.nextStep, stepId === "business" ? "availability" : null)
        }
      }
    } else {
      await assert.rejects(() => loadStep("business"), (error: unknown) => (
        error instanceof Response &&
        error.headers.get("Location") === "/onboarding/subscription?billing=year"
      ))
      businessComplete = false
      await assert.rejects(() => loadStep("subscription"), (error: unknown) => (
        error instanceof Response &&
        error.headers.get("Location") === "/onboarding/business?billing=year"
      ))
      businessComplete = true
      for (const pending of ["availability", "holidays"]) {
        onboardingStep = pending
        await assert.rejects(() => loadStep("subscription"), (error: unknown) => (
          error instanceof Response && error.headers.get("Location") === `/onboarding/${pending}?billing=year`
        ))
      }
      onboardingStep = null
      subscriptionComplete = true
      await assert.rejects(() => loadStep("business"), (error: unknown) => (
        error instanceof Response && error.headers.get("Location") === "/"
      ))
    }

    console.info(`PASS onboarding routing with demo bypass ${demoBypassEnabled ? "enabled" : "disabled"}`)
  } finally {
    queryCacheOptions.gcTime = originalGcTime
    prisma.member.findFirst = originalFindMember
    prisma.subscription.findFirst = originalFindSubscription
  }
} finally {
  await vite.close()
}
