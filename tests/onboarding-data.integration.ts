import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

// Exercise query callers with a fake database and billing disabled.
process.env.NODE_ENV = process.argv.includes("--production") ? "production" : "test"
const demoBypassEnabled = process.argv.includes("--demo") && process.env.NODE_ENV !== "production"
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = String(process.argv.includes("--demo"))
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
  let activeSubscription: { id: string; status: string; canceledAt?: Date | null; endedAt?: Date | null; cancelAt?: Date | null; cancelAtPeriodEnd?: boolean; periodEnd?: Date } | null = null
  let savedCurrency: string | undefined
  let savedBusinessName: string | undefined
  let existingSettings: { countryCode: string, timezone: string } | null = null
  const context = {
    headers: new Headers(),
    user: { id: "onboarding-user", name: "Matti Meikäläinen" },
    session: null,
    organizationId: null as string | null,
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
          findUnique: () => Promise<typeof existingSettings>
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
          findUnique: async () => existingSettings,
          upsert: async ({ create, update }) => {
            assert.equal(create.currency, update.currency)
            savedCurrency = update.currency
          },
        },
      }),
      member: {
        findFirst: async ({ where }: { where: { userId: string; organizationId?: string } }) => {
          assert.equal(where.userId, "onboarding-user")
          assert.equal(where.organizationId, context.organizationId ?? undefined)
          return membership
        },
      },
      subscription: {
        findFirst: async () => null,
        findMany: async ({ where }: {
          where: { referenceId: string, status: { in: string[] } }
        }) => {
          assert.equal(where.referenceId, membership?.organizationId)
          assert.deepEqual(where.status.in, ["active", "past_due", "trialing"])
          return activeSubscription ? [activeSubscription] : []
        },
      },
    },
  }
  const caller = router.createCaller(context as unknown as Context)

  assert.deepEqual(await caller.status(), {
    billingEnabled: demoBypassEnabled,
    businessComplete: false,
    locationComplete: false,
    availabilityComplete: false,
    holidaysComplete: false,
    setupComplete: false,
    demoOnboardingPaymentBypassEnabled: demoBypassEnabled,
    subscriptionComplete: false,
    previouslySubscribed: false,
  })

  context.headers.set("x-real-ip", "8.8.4.4")
  globalThis.fetch = async () => Response.json({ ip: "8.8.4.4", location: { country: "FI", timezone: "Europe/Helsinki", currency: ["EUR"] } })
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
  assert.equal((await caller.business()).currency, "")
  ipResponse.location.currency = ["USD"]

  ipResponse.location.country = "JP"
  ipResponse.location.currency = ["JPY"]
  ipResponse.location.timezone = "Asia/Tokyo"
  const unsupportedDefaults = await caller.business()
  assert.equal(unsupportedDefaults.location, "")
  assert.equal(unsupportedDefaults.currency, "")
  assert.equal(unsupportedDefaults.timezone, "")
  // An unsupported country must not populate even otherwise supported values
  ipResponse.location.currency = ["USD"]
  ipResponse.location.timezone = "America/Chicago"
  assert.deepEqual(await caller.business(), unsupportedDefaults)

  const { onboardingCurrencyItems, onboardingTimezoneItems } = await vite.ssrLoadModule("/app/lib/localization/onboarding.ts") as typeof import("../app/lib/localization/onboarding")
  const { onboardingFormSchema } = await vite.ssrLoadModule("/app/lib/schemas/onboarding.ts") as typeof import("../app/lib/schemas/onboarding")
  assert.deepEqual(onboardingCurrencyItems.map(({ value }) => value).sort(), [
    "AUD", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HUF", "ISK", "NOK", "NZD", "PLN", "RON", "SEK", "USD",
  ])
  const timezoneValues = new Set(onboardingTimezoneItems.map(({ value }) => value))
  for (const timezone of ["Europe/Helsinki", "Asia/Nicosia", "Asia/Famagusta", "Atlantic/Azores", "Atlantic/Canary", "Pacific/Chatham", "Australia/Lord_Howe", "America/St_Johns", "America/Chicago", "Pacific/Honolulu"]) {
    assert.ok(timezoneValues.has(timezone), `${timezone} must be available`)
  }
  for (const timezone of ["Asia/Tokyo", "Asia/Kolkata", "America/Mexico_City", "Africa/Johannesburg"]) {
    assert.equal(timezoneValues.has(timezone), false)
    assert.equal(onboardingFormSchema.safeParse({ ...defaults, businessName: "Yritys Oy", timezone }).success, false)
  }
  for (const { value: currency } of onboardingCurrencyItems) {
    assert.equal(onboardingFormSchema.safeParse({ ...defaults, businessName: "Yritys Oy", currency }).success, true)
  }
  for (const { value: timezone } of onboardingTimezoneItems) {
    assert.equal(onboardingFormSchema.safeParse({ ...defaults, businessName: "Yritys Oy", timezone }).success, true)
  }
  assert.equal(onboardingFormSchema.parse({ ...defaults, businessName: "Yritys Oy", timezone: "US/Eastern" }).timezone, "America/New_York")
  for (const input of [{ currency: "JPY" }, { timezone: "Asia/Tokyo" }, { location: "" }, { currency: "" }, { timezone: "" }]) {
    await assert.rejects(caller.complete({ ...defaults, businessName: "Yritys Oy", ...input }), { code: "BAD_REQUEST" })
  }

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
  activeSubscription = { id: "subscription-active", status: "active" }
  assert.equal((await caller.status()).subscriptionComplete, true)
  for (const cancellation of [{ endedAt: new Date(0) }, { cancelAt: new Date(0) }, { periodEnd: new Date(0) }]) {
    activeSubscription = { id: "canceled-subscription", status: "active", ...cancellation }
    assert.equal((await caller.status()).subscriptionComplete, false)
  }
  activeSubscription = { id: "paid-until-period-end", status: "active", canceledAt: new Date(), cancelAtPeriodEnd: true, periodEnd: new Date(Date.now() + 86_400_000) }
  assert.equal((await caller.status()).subscriptionComplete, true, "Scheduled cancellation retains access through the paid period")
  activeSubscription = null
  context.organizationId = "onboarding-org"
  await caller.status()
  await caller.business()
  await caller.subscription()
  membership.role = "member"
  await assert.rejects(caller.complete({ businessName: "Yritys Oy", currency: "EUR", location: "fi", name: "Matti Meikäläinen", timezone: "Europe/Helsinki" }), { code: "FORBIDDEN" })
  membership.role = "owner"

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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await caller.complete(updatedDetails)
    assert.equal(result.organizationId, "onboarding-org")
    assert.equal(savedCurrency, "EUR")
    assert.equal(savedBusinessName, updatedDetails.businessName)
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
  assert.deepEqual(subscription.plans.map((plan) => [plan.id, plan.monthlyAmount]), [["solo", 4000], ["team", 8000]])
  assert.ok(subscription.plans[0]!.features.length > 0)

  const englishCaller = router.createCaller({ ...context, locale: "en" } as unknown as Context)
  const englishSubscription = await englishCaller.subscription()
  assert.equal(englishSubscription.locale, "en")
  assert.notDeepEqual(englishSubscription.plans[0]!.features, subscription.plans[0]!.features)

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
