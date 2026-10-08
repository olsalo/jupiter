import "dotenv/config"
import assert from "node:assert/strict"
import { RouterContextProvider, type RouterContext } from "react-router"
import { createServer } from "vite"

// Enable the subscription step without making Stripe or database requests.
process.env.NODE_ENV = "test"
process.env.STRIPE_SECRET_KEY = "sk_test_onboarding_routing"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_onboarding_routing"
process.env.STRIPE_PRO_PRICE_ID = "price_onboarding_routing"
const vite = await createServer({
  configFile: false,
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
  const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
  const { sessionContext } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const { queryCacheOptions } = await vite.ssrLoadModule("/app/lib/query-cache.ts") as typeof import("../app/lib/query-cache")
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
  prisma.member.findFirst = (async () => ({
    organizationId: "onboarding-routing-org",
    organization: { settings: { location: "FI", timezone: "Europe/Helsinki" } },
  })) as unknown as typeof prisma.member.findFirst
  prisma.subscription.findFirst = (async () => null) as typeof prisma.subscription.findFirst

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
      assert.equal(result.data.step, 2)
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

    console.info("PASS onboarding data requests do not redirect to themselves, and entry redirects preserve billing")
  } finally {
    queryCacheOptions.gcTime = originalGcTime
    prisma.member.findFirst = originalFindMember
    prisma.subscription.findFirst = originalFindSubscription
  }
} finally {
  await vite.close()
}
