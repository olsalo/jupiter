import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

// Exercise query callers with a fake database and billing disabled.
process.env.NODE_ENV = "test"
const demoBypassEnabled = process.argv.includes("--demo")
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = String(demoBypassEnabled)
process.env.STRIPE_SECRET_KEY = ""
process.env.LOCATION_API_KEY = "onboarding-test-key"
const originalFetch = globalThis.fetch
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/onboarding-data",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { onboardingRouter } = await vite.ssrLoadModule("/app/.server/routers/onboarding.ts") as typeof import("../app/.server/routers/onboarding")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const router = createTRPCRouter(onboardingRouter)
  type Context = Parameters<typeof router.createCaller>[0]
  let membership: {
    organizationId: string
    role: string
    organization: {
      name: string
      settings: { currency: string, countryCode: string, timezone: string } | null
    }
  } | null = null
  let activeSubscription: { id: string } | null = null
  let savedCurrency: string | undefined
  let savedBusinessName: string | undefined
  let existingSettings: { countryCode: string, timezone: string } | null = null
  const context = {
    headers: new Headers(),
    user: { id: "onboarding-user", name: "Matti Meikäläinen" },
    session: null,
    organizationId: null,
    locale: "fi",
    prisma: {
      organizationSettings: { findUnique: async () => existingSettings },
      $transaction: async (callback: (transaction: {
        $queryRaw: () => Promise<unknown[]>
        location: { findFirst: () => Promise<{ id: string }> }
        member: { findFirstOrThrow: () => Promise<{ id: string }> }
        staffMember: { upsert: () => Promise<{ id: string }> }
        user: { update: () => Promise<void> }
        organization: {
          update: (args: { data: { name: string }, where: { id: string } }) => Promise<void>
        }
        organizationSettings: {
          upsert: (args: { create: { currency: string }, update: { currency: string } }) => Promise<void>
        }
      }) => Promise<void>) => callback({
        $queryRaw: async () => [],
        location: { findFirst: async () => ({ id: "onboarding-location" }) },
        member: { findFirstOrThrow: async () => ({ id: "onboarding-member" }) },
        staffMember: { upsert: async () => ({ id: "onboarding-staff" }) },
        user: { update: async () => undefined },
        organization: {
          update: async ({ data, where }) => {
            assert.equal(where.id, membership?.organizationId)
            savedBusinessName = data.name
          },
        },
        organizationSettings: {
          upsert: async ({ create, update }) => {
            assert.equal(create.currency, update.currency)
            savedCurrency = update.currency
          },
        },
      }),
      member: {
        findFirst: async ({ where }: { where: { userId: string } }) => {
          assert.equal(where.userId, "onboarding-user")
          return membership
        },
      },
      subscription: {
        findFirst: async ({ where }: {
          where: { referenceId: string, status: { in: string[] } }
        }) => {
          assert.equal(where.referenceId, membership?.organizationId)
          assert.deepEqual(where.status.in, ["active", "past_due", "trialing"])
          return activeSubscription
        },
      },
    },
  }
  const caller = router.createCaller(context as unknown as Context)

  assert.deepEqual(await caller.status(), {
    billingEnabled: demoBypassEnabled,
    businessComplete: false,
    availabilityComplete: false,
    holidaysComplete: false,
    setupComplete: false,
    demoOnboardingPaymentBypassEnabled: demoBypassEnabled,
    subscriptionComplete: false,
  })

  const defaults = await caller.business()
  assert.equal(defaults.name, "Matti Meikäläinen")
  assert.equal(defaults.businessName, "")
  assert.equal(defaults.currency, "EUR")
  assert.equal(defaults.location, "fi")
  assert.equal(defaults.timezone, "Europe/Helsinki")

  const ipResponse = {
    ip: "8.8.8.8",
    location: {
      country: "US",
      timezone: "America/Chicago",
      currency: ["USD", "USN", "USS"],
    },
  }
  globalThis.fetch = async () => Response.json(ipResponse)
  context.headers.set("x-real-ip", ipResponse.ip)
  const ipDefaults = await caller.business()
  assert.equal(ipDefaults.location, "us")
  assert.equal(ipDefaults.timezone, "America/Chicago")
  assert.equal(ipDefaults.currency, "USD")

  ipResponse.location.currency = ["USN", "USD"]
  assert.equal((await caller.business()).currency, "USD")
  ipResponse.location.currency = ["ZZZ"]
  assert.equal((await caller.business()).currency, "EUR")
  ipResponse.location.currency = ["USD"]

  membership = {
    organizationId: "onboarding-org",
    role: "owner",
    organization: {
      name: "Yritys Oy",
      settings: { currency: "SEK", countryCode: "SE", timezone: "Europe/Stockholm" },
    },
  }
  assert.deepEqual(await caller.business(), {
    name: "Matti Meikäläinen",
    businessName: "Yritys Oy",
    currency: "SEK",
    location: "se",
    timezone: "Europe/Stockholm",
  })
  context.headers.delete("x-real-ip")

  assert.equal((await caller.status()).businessComplete, true)
  assert.equal((await caller.status()).subscriptionComplete, false)
  activeSubscription = { id: "subscription-active" }
  assert.equal((await caller.status()).subscriptionComplete, true)
  activeSubscription = null

  await caller.complete({
    businessName: "Yritys Oy",
    currency: "sek",
    location: "se",
    name: "Matti Meikäläinen",
    timezone: "Europe/Stockholm",
  })
  assert.equal(savedCurrency, "SEK")
  existingSettings = { countryCode: "SE", timezone: "Europe/Stockholm" }
  const updatedDetails = {
    businessName: "Uusi Yritys Oy",
    currency: "eur",
    location: "fi",
    name: "Matti Meikäläinen",
    timezone: "Europe/Helsinki",
  }
  if (demoBypassEnabled) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await caller.complete(updatedDetails)
      assert.equal(result.organizationId, "onboarding-org")
      assert.equal(savedCurrency, "EUR")
      assert.equal(savedBusinessName, updatedDetails.businessName)
    }
  } else {
    await assert.rejects(() => caller.complete(updatedDetails), (error: unknown) => (
      error instanceof Error && "code" in error && error.code === "CONFLICT"
    ))
    assert.equal(savedCurrency, "SEK")
    assert.equal(savedBusinessName, undefined)
  }
  await assert.rejects(() => caller.complete({
    ...defaults,
    businessName: "Yritys Oy",
    currency: "ZZZ",
  }), (error: unknown) => (
    error instanceof Error && "code" in error && error.code === "BAD_REQUEST"
  ))

  const subscription = await caller.subscription()
  assert.equal(subscription.organizationId, "onboarding-org")
  assert.equal(subscription.billingEnabled, false)
  assert.equal(subscription.locale, "fi")
  assert.deepEqual(subscription.prices, { month: null, year: null })
  assert.ok(subscription.plan.features.length > 0)

  const englishCaller = router.createCaller({ ...context, locale: "en" } as unknown as Context)
  const englishSubscription = await englishCaller.subscription()
  assert.equal(englishSubscription.locale, "en")
  assert.notDeepEqual(englishSubscription.plan.features, subscription.plan.features)

  const anonymousCaller = router.createCaller({ ...context, user: undefined } as unknown as Context)
  for (const query of [() => anonymousCaller.status(), () => anonymousCaller.business(), () => anonymousCaller.subscription()]) {
    await assert.rejects(query, (error: unknown) => (
      error instanceof Error && "code" in error && error.code === "UNAUTHORIZED"
    ))
  }

  console.info(`PASS onboarding data and repeated business saves with demo bypass ${demoBypassEnabled ? "enabled" : "disabled"}`)
} finally {
  globalThis.fetch = originalFetch
  await vite.close()
}
