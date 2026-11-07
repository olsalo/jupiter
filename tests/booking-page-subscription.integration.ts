import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.STRIPE_SECRET_KEY = "sk_test_booking_page"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_booking_page"
process.env.STRIPE_SOLO_PRICE_ID = "price_solo"
process.env.STRIPE_TEAM_PRICE_ID = "price_team"
process.env.STRIPE_EXTRA_STAFF_PRICE_ID = "price_extra"

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/booking-page-subscription",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
  const { defaultBookingSettings } = await vite.ssrLoadModule("/app/lib/schemas/booking-settings.ts") as typeof import("../app/lib/schemas/booking-settings")
  const { resolveBookingPage } = await vite.ssrLoadModule("/app/.server/services/booking-page.ts") as typeof import("../app/.server/services/booking-page")
  const organization = { id: "org", name: "Test", slug: "test", settings: { ...defaultBookingSettings } }
  let page: { isActive: boolean; services: []; staff: [] } | null = null
  let subscription: { status: string; plan: string; periodEnd: Date | null } | null = null
  const database = {
    member: { findFirst: async () => ({ role: "owner", organization }) },
    organization: { findUnique: async () => organization },
    organizationSettings: { findUnique: async () => organization.settings },
    bookingPage: { findFirst: async () => page },
    service: { findMany: async () => [] },
    staffMember: { findMany: async () => [] },
    location: { findMany: async () => [] },
    subscription: { findMany: async () => subscription ? [subscription] : [] },
  }
  const caller = appRouter.createCaller({
    prisma: database, user: { id: "owner" }, session: { activeOrganizationId: "org" },
    organizationId: "org", headers: new Headers(), locale: "fi", formatPreference: "eu", formatLocale: "fi-FI",
  } as unknown as Parameters<typeof appRouter.createCaller>[0])

  const check = async (enabled: boolean, bookingEnabled = enabled) => {
    const result = await caller.bookingPage.get()
    assert.equal(result.values.isActive, enabled)
    assert.equal(result.bookingEnabled, bookingEnabled)
    assert.equal(result.published, enabled)
    assert.equal((await caller.organizations.bookingSettings()).bookingEnabled, enabled)
  }
  await check(false)
  await assert.rejects(resolveBookingPage(database as never, { organizationSlug: "test" }), { code: "FORBIDDEN" })
  subscription = { status: "active", plan: "solo", periodEnd: null }
  await check(true)
  await resolveBookingPage(database as never, { organizationSlug: "test" })
  page = { isActive: true, services: [], staff: [] }
  await check(true)
  subscription = { ...subscription, periodEnd: new Date(Date.now() - 1000) }
  await check(false)
  subscription = null
  await check(false)
  assert.equal(organization.settings.bookingEnabled, true, "Subscription loss preserves the default preference")
  assert.equal(page.isActive, true, "Subscription loss preserves the page preference")
  subscription = { status: "trialing", plan: "solo", periodEnd: null }
  await check(true)
  page.isActive = false
  await check(false, true)
  page.isActive = true
  organization.settings.bookingEnabled = false
  await check(false)
  console.info("PASS booking defaults, missing and expired subscriptions, restored access, and manual disabling")
} finally {
  await vite.close()
}
