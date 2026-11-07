import "dotenv/config"
import assert from "node:assert/strict"
import { RouterContextProvider, type RouterContext } from "react-router"
import { createServer } from "vite"

// Enable the subscription step without making Stripe or database requests.
const productionMode = process.argv.includes("--production")
process.env.NODE_ENV = productionMode ? "production" : "test"
const demoBypassEnabled = process.argv.includes("--demo") && !productionMode
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = String(process.argv.includes("--demo"))
process.env.STRIPE_SECRET_KEY = "sk_test_onboarding_routing"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_onboarding_routing"
process.env.STRIPE_SOLO_PRICE_ID = "price_onboarding_routing"
process.env.STRIPE_TEAM_PRICE_ID = "price_team"
process.env.STRIPE_EXTRA_STAFF_PRICE_ID = "price_extra"
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
  const { loader: dashboardLoader } = await vite.ssrLoadModule("/app/routes/layout.tsx") as typeof import("../app/routes/layout")
  const { isBillingEnforced, assertOrganizationSubscription } = await vite.ssrLoadModule("/app/lib/billing/billing.server.ts") as typeof import("../app/lib/billing/billing.server")
  const { createResourceLimits } = await vite.ssrLoadModule("/app/.server/resource-limits/service.ts") as typeof import("../app/.server/resource-limits/service")
  const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
  const { sessionContext, organizationContext } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const { queryCacheOptions } = await vite.ssrLoadModule("/app/lib/query/query-cache.ts") as typeof import("../app/lib/query/query-cache")
  const originalGcTime = queryCacheOptions.gcTime
  queryCacheOptions.gcTime = Infinity
  type AuthSession = typeof sessionContext extends RouterContext<infer Value> ? Value : never
  const context = new RouterContextProvider()
  context.set(sessionContext, {
    user: { id: "onboarding-routing-user", name: "Matti Meikäläinen" },
    session: { activeOrganizationId: null },
  } as AuthSession)

  type AuthOrganization = typeof organizationContext extends RouterContext<infer Value> ? Value : never
  context.set(organizationContext, { id: "onboarding-routing-org" } as AuthOrganization)
  const originalFindMember = prisma.member.findFirst
  const originalFindSubscription = prisma.subscription.findMany
  const originalFindPreviousSubscription = prisma.subscription.findFirst
  let businessComplete = true
  let subscriptionComplete = false
  let previouslySubscribed = false
  let onboardingStep: string | null = null
  prisma.member.findFirst = (async () => ({
    organizationId: "onboarding-routing-org",
    organization: { settings: businessComplete ? { countryCode: "FI", timezone: "Europe/Helsinki", onboardingStep } : null },
  })) as unknown as typeof prisma.member.findFirst
  prisma.subscription.findMany = (async () => subscriptionComplete ? [{ id: "onboarding-subscription", status: "active" }] : []) as unknown as typeof prisma.subscription.findMany
  prisma.subscription.findFirst = (async () => previouslySubscribed ? { id: "previous-subscription" } : null) as unknown as typeof prisma.subscription.findFirst

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
      assert.equal(result.data.step, 5)
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

    const stepIds = ["business", "location", "availability", "holidays", "subscription"] as const
    const loadStep = (stepId: typeof stepIds[number]) => loader({
      request: new Request(`http://localhost:5174/onboarding/${stepId}.data?billing=year`),
      url: new URL(`http://localhost:5174/onboarding/${stepId}?billing=year`),
      params: {}, context, pattern: `/onboarding/${stepId}`,
    })
    for (let pendingIndex = 0; pendingIndex <= stepIds.length; pendingIndex++) {
      businessComplete = pendingIndex > 0
      subscriptionComplete = pendingIndex === stepIds.length
      onboardingStep = pendingIndex === 1 ? "location" : pendingIndex === 2 ? "availability" : pendingIndex === 3 ? "holidays" : null
      for (const [index, stepId] of stepIds.entries()) {
        const canVisit = index === pendingIndex || !productionMode
        if (canVisit) {
          const result = await loadStep(stepId)
          assert.equal(result.data.stepId, stepId)
          assert.equal(result.data.step, index + 1)
          assert.equal(result.data.totalSteps, 5)
          const next = stepIds.slice(index + 1).find((id) => !productionMode || id !== "subscription" || !subscriptionComplete) ?? null
          assert.equal(result.data.nextStep, next)
        } else {
          const destination = pendingIndex === stepIds.length ? "/calendar" : `/onboarding/${stepIds[pendingIndex]}?billing=year`
          await assert.rejects(loadStep(stepId), (error: unknown) => error instanceof Response && error.headers.get("Location") === destination, `${stepId} respects the ${stepIds[pendingIndex] ?? "completed"} setup state`)
        }
      }
    }
    businessComplete = true
    subscriptionComplete = true
    onboardingStep = null
    await assert.rejects(() => loader({
      request: new Request("http://localhost/onboarding?redirectTo=%2Fcustomers%2Fcustomer-one"),
      url: new URL("http://localhost/onboarding?redirectTo=%2Fcustomers%2Fcustomer-one"),
      params: {}, context, pattern: "/onboarding",
    }), (error: unknown) => error instanceof Response && error.headers.get("Location") === (
      productionMode ? "/customers/customer-one" : "/onboarding/business?redirectTo=%2Fcustomers%2Fcustomer-one"
    ))

    const originalFindMembers = prisma.member.findMany
    const originalFindSettings = prisma.organizationSettings.findUnique
    const originalStaffCount = prisma.staffMember.count
    const originalNodeEnv = process.env.NODE_ENV
    const originalDemoBypass = process.env.DEMO_BYPASS_ONBOARDING_PAYMENT
    try {
      businessComplete = true
      subscriptionComplete = false
      onboardingStep = "location"
      prisma.member.findMany = (async () => [{ role: "member", organization: { id: "onboarding-routing-org", name: "Test business" } }]) as unknown as typeof prisma.member.findMany
      prisma.organizationSettings.findUnique = (async () => ({ timezone: "Europe/Helsinki" })) as unknown as typeof prisma.organizationSettings.findUnique
      prisma.staffMember.count = (async () => 0) as typeof prisma.staffMember.count
      const dashboardArgs = { request: new Request("http://localhost/calendar"), url: new URL("http://localhost/calendar"), params: {}, context, pattern: "/calendar" }
      process.env.NODE_ENV = "development"
      process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "false"
      assert.equal(isBillingEnforced(), true)
      await assert.rejects(assertOrganizationSubscription("onboarding-routing-org", prisma), { code: "FORBIDDEN" }, "Development blocks changes without a subscription")
      const developmentWorkspace = await dashboardLoader(dashboardArgs)
      assert.equal(developmentWorkspace.org?.id, "onboarding-routing-org", "Development can bypass onboarding")
      assert.equal(developmentWorkspace.subscriptionReadOnly, true, "Bypassing onboarding leaves the workspace read-only")
      assert.deepEqual(developmentWorkspace.billingNotification, { type: "subscription-inactive" }, "Members see the inactive subscription alert")
      await assert.rejects(createResourceLimits(prisma).assert("onboarding-routing-org", "teamMembers"), { appCode: "RESOURCE_LIMIT_REACHED" })
      process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "true"
      assert.equal(isBillingEnforced(), true, "The onboarding demo bypass does not bypass billing enforcement")
      await assert.rejects(assertOrganizationSubscription("onboarding-routing-org", prisma), { code: "FORBIDDEN" })
      subscriptionComplete = true
      assert.equal((await dashboardLoader(dashboardArgs)).org?.id, "onboarding-routing-org", "A subscribed business can open the development app")
      subscriptionComplete = false
      process.env.NODE_ENV = "production"
      assert.equal(isBillingEnforced(), true)
      await assert.rejects(dashboardLoader(dashboardArgs), (error: unknown) => error instanceof Response && error.headers.get("Location") === "/onboarding?redirectTo=%2Fcalendar", "Production still requires onboarding")
      onboardingStep = null
      previouslySubscribed = true
      const inactiveWorkspace = await dashboardLoader(dashboardArgs)
      assert.equal(inactiveWorkspace.org?.id, "onboarding-routing-org", "A previously subscribed business can open the workspace")
      assert.equal(inactiveWorkspace.subscriptionReadOnly, true, "An inactive subscription makes the workspace read-only")
      subscriptionComplete = true
      assert.equal((await dashboardLoader(dashboardArgs)).subscriptionReadOnly, false, "An active subscription allows changes")
      subscriptionComplete = false
      await assert.rejects(loadStep("subscription"), (error: unknown) => error instanceof Response && error.headers.get("Location") === "/calendar", "A previously subscribed business does not return to onboarding")
      await assert.rejects(assertOrganizationSubscription("onboarding-routing-org", prisma), { code: "FORBIDDEN" }, "Production still requires an active subscription")
      await assert.rejects(createResourceLimits(prisma).assert("onboarding-routing-org", "teamMembers"), { appCode: "RESOURCE_LIMIT_REACHED" }, "Unsubscribed production businesses cannot add bookable staff")
    } finally {
      process.env.NODE_ENV = originalNodeEnv
      process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = originalDemoBypass
      prisma.member.findMany = originalFindMembers
      prisma.organizationSettings.findUnique = originalFindSettings
      prisma.staffMember.count = originalStaffCount
    }

    console.info(`PASS ${productionMode ? "production" : "non-production"} onboarding routing with demo bypass ${demoBypassEnabled ? "enabled" : "disabled"}`)
  } finally {
    queryCacheOptions.gcTime = originalGcTime
    prisma.member.findFirst = originalFindMember
    prisma.subscription.findMany = originalFindSubscription
    prisma.subscription.findFirst = originalFindPreviousSubscription
  }
} finally {
  await vite.close()
}
