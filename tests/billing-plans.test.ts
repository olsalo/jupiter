import assert from "node:assert/strict"
import { createServer } from "vite"
import type Stripe from "stripe"
import type { PrismaClient } from "../generated/prisma/client"

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
process.env.STRIPE_SECRET_KEY = "sk_test_jupiter_billing"
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_jupiter_billing"
for (const [key, value] of Object.entries({ SOLO: "solo", TEAM: "team", EXTRA_STAFF: "extra" })) {
  process.env[`STRIPE_${key}_PRICE_ID`] = `price_${value}_month`
  process.env[`STRIPE_${key}_ANNUAL_PRICE_ID`] = `price_${value}_year`
}
const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/billing-plans", appType: "custom", resolve: { alias: { "~": appPath } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server")
  const { stripeClient } = await vite.ssrLoadModule("/app/lib/billing/stripe.server.ts") as typeof import("../app/lib/billing/stripe.server")
  const { getPlanAmount, getPlanCapacity } = await vite.ssrLoadModule("/app/lib/billing/plans.ts") as typeof import("../app/lib/billing/plans")
  const { saveBillingPlan, syncStripeSubscription, getBillingPlanState } = await vite.ssrLoadModule("/app/lib/billing/subscriptions.server.ts") as typeof import("../app/lib/billing/subscriptions.server")
  const { billingPlanSchema, billingPlanFormSchema } = await vite.ssrLoadModule("/app/lib/schemas/billing.ts") as typeof import("../app/lib/schemas/billing")
  assert.ok(stripeClient)
  assert.equal(getPlanAmount("solo", "month", 0), 4000)
  assert.equal(getPlanAmount("team", "month", 2), 11000)
  assert.equal(getPlanAmount("team", "year", 2), 110000)
  assert.equal(getPlanCapacity("team", 2), 5)
  for (const extraStaff of [-1, 0.5, 1001, ""]) assert.equal(billingPlanSchema.safeParse({ planId: "team", interval: "month", extraStaff }).success, extraStaff === "")
  assert.equal(billingPlanSchema.safeParse({ planId: "solo", interval: "month", extraStaff: 1 }).success, false)
  assert.deepEqual(billingPlanFormSchema.parse({ planId: "team", interval: "month", bookablePeople: 3 }), { planId: "team", interval: "month", extraStaff: 0 })
  assert.deepEqual(billingPlanFormSchema.parse({ planId: "team", interval: "month", bookablePeople: 5 }), { planId: "team", interval: "month", extraStaff: 2 })
  assert.deepEqual(billingPlanFormSchema.parse({ planId: "solo", interval: "month", bookablePeople: 1 }), { planId: "solo", interval: "month", extraStaff: 0 })
  assert.equal(billingPlanFormSchema.safeParse({ planId: "team", interval: "month", bookablePeople: 2 }).success, false)

  let used = 1
  let customerId: string | null = null
  let live: Stripe.Subscription | null = null
  let schedule: Stripe.SubscriptionSchedule | null = null
  let failPayment = false
  let invalidPrice = false
  let checkoutCalls = 0
  let subscriptionUpdates = 0
  let checkoutInput: Stripe.Checkout.SessionCreateParams | undefined
  let updateInput: Stripe.SubscriptionUpdateParams | undefined
  let scheduleInput: Stripe.SubscriptionScheduleUpdateParams | undefined
  const rows: Record<string, unknown>[] = []
  const now = Math.floor(Date.now() / 1000)
  const price = (id: string) => {
    const year = id.endsWith("year")
    const base = id.includes("solo") ? 4000 : id.includes("team") ? 8000 : 1500
    return { id, active: true, currency: "eur", unit_amount: invalidPrice ? 1 : base * (year ? 10 : 1), tax_behavior: "exclusive", recurring: { interval: year ? "year" : "month", interval_count: 1, usage_type: "licensed" } } as Stripe.Price
  }
  const item = (id: string, quantity = 1, index = 0) => ({ id: `si_${index}`, price: price(id), quantity, current_period_start: now, current_period_end: now + 86400 * 30 }) as Stripe.SubscriptionItem
  const makeSubscription = (base: "solo" | "team", extra = 0) => ({ id: "sub_test", customer: "cus_test", status: "active", metadata: {}, cancel_at_period_end: false, cancel_at: null, canceled_at: null, ended_at: null, schedule: null, latest_invoice: "in_original", pending_update: null, items: { data: [item(`price_${base}_month`), ...(extra ? [item("price_extra_month", extra, 1)] : [])] } }) as unknown as Stripe.Subscription
  const localSubscription = {
    findFirst: async ({ where }: { where: { referenceId: string; OR: { id?: string; stripeSubscriptionId?: string }[] } }) => rows.find((row) => row.referenceId === where.referenceId && where.OR.some((match) => (match.id && row.id === match.id) || (match.stripeSubscriptionId && row.stripeSubscriptionId === match.stripeSubscriptionId))) ?? null,
    findMany: async () => rows,
    create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data }; rows.push(row); return row },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => { const row = rows.find((row) => row.id === where.id)!; Object.assign(row, data); return row },
  }
  const organization = {
    findUnique: async () => ({ id: "org_test", stripeCustomerId: customerId }),
    findUniqueOrThrow: async () => ({ id: "org_test", name: "Test", stripeCustomerId: customerId }),
    findFirst: async () => customerId ? { id: "org_test" } : null,
    update: async ({ data }: { data: { stripeCustomerId: string } }) => { customerId = data.stripeCustomerId },
  }
  let disabledIds: string[] = []
  const staffMember = {
    count: async ({ where }: { where: { organizationId: string; id?: { in: string[] } } }) => where.id ? where.id.in.filter((id) => Array.from({ length: used }, (_, index) => `staff_${index + 1}`).includes(id)).length : used,
    updateMany: async ({ where, data }: { where: { organizationId: string; id: { in: string[] } }; data: { acceptsAppointments: boolean } }) => {
      assert.equal(where.organizationId, "org_test")
      assert.equal(data.acceptsAppointments, false)
      disabledIds = where.id.in
      used -= disabledIds.length
      return { count: disabledIds.length }
    },
  }
  const db = { $queryRaw: async () => [], subscription: localSubscription, organization, staffMember } as unknown as PrismaClient
  Object.assign(prisma, { $transaction: async (callback: (db: PrismaClient) => Promise<unknown>) => callback(db) })
  Object.assign(prisma.organization, organization)
  Object.assign(prisma.subscription, localSubscription)
  Object.assign(prisma.staffMember, staffMember)
  Object.assign(stripeClient.prices, { retrieve: async (id: string) => price(id) })
  Object.assign(stripeClient.customers, { create: async () => ({ id: "cus_test" }) })
  Object.assign(stripeClient.checkout.sessions, {
    list: async () => ({ data: [] }),
    create: async (input: Stripe.Checkout.SessionCreateParams) => { checkoutCalls++; checkoutInput = input; return { id: "cs_test", url: "https://checkout.stripe.test/test" } },
  })
  Object.assign(stripeClient.subscriptions, {
    list: async () => ({ data: live ? [live] : [] }),
    retrieve: async () => structuredClone(live),
    update: async (_id: string, input: Stripe.SubscriptionUpdateParams) => {
      subscriptionUpdates++; updateInput = input
      if (failPayment) return { ...structuredClone(live), pending_update: { expires_at: now + 3600 }, latest_invoice: { id: "in_pending", hosted_invoice_url: "https://invoice.stripe.test/pay" } }
      live!.items.data = input.items!.filter((value) => !value.deleted).map((value, index) => item(value.price!, value.quantity ?? 1, index))
      return structuredClone(live)
    },
  })
  Object.assign(stripeClient.subscriptionSchedules, {
    retrieve: async () => structuredClone(schedule),
    create: async () => { live!.schedule = "sched_test"; schedule = { id: "sched_test", status: "active", phases: [{ start_date: now, end_date: now + 86400 * 30, items: [] }] } as unknown as Stripe.SubscriptionSchedule; return structuredClone(schedule) },
    update: async (_id: string, input: Stripe.SubscriptionScheduleUpdateParams) => { scheduleInput = input; schedule!.phases = input.phases as unknown as Stripe.SubscriptionSchedule.Phase[]; return structuredClone(schedule) },
    release: async () => { live!.schedule = null; schedule = null },
  })
  const save = (planId: "solo" | "team", extraStaff = 0, interval: "month" | "year" = "month", disableStaffIds?: string[]) => saveBillingPlan({ organizationId: "org_test", email: "owner@example.invalid", input: { planId, extraStaff, interval, disableStaffIds }, returnUrl: "http://localhost:5175/", cancelUrl: "http://localhost:5175/onboarding/subscription", locale: "en" })
  await save("solo")
  assert.equal(checkoutCalls, 1)
  assert.deepEqual(checkoutInput?.line_items, [{ price: "price_solo_month", quantity: 1 }])
  assert.equal(checkoutInput?.automatic_tax?.enabled, true)
  assert.equal(checkoutInput?.tax_id_collection?.enabled, true)
  assert.equal(checkoutInput?.subscription_data?.trial_period_days, 14)
  assert.equal(checkoutInput?.cancel_url, "http://localhost:5175/onboarding/subscription")
  live = makeSubscription("solo")
  live.metadata.subscriptionId = rows[0]!.id as string
  await syncStripeSubscription(live.id)
  assert.equal(rows.length, 1, "Checkout and webhook update the same local row")
  assert.equal(rows[0]!.seats, 1)
  failPayment = true
  const pending = await save("team", 2)
  assert.equal(pending.paymentPending, true)
  assert.equal(pending.url, "https://invoice.stripe.test/pay")
  assert.equal(rows[0]!.seats, 1, "A failed upgrade must not grant extra capacity")
  assert.equal(updateInput?.payment_behavior, "pending_if_incomplete")
  failPayment = false
  await save("team", 2)
  assert.equal(rows[0]!.seats, 5)
  assert.equal(rows[0]!.plan, "team")
  const before = subscriptionUpdates
  await save("team", 2)
  assert.equal(subscriptionUpdates, before, "Repeating the applied choice does not charge again")
  used = 5
  await assert.rejects(save("team", 1), { code: "BAD_REQUEST" })
  assert.equal(schedule, null)
  await assert.rejects(save("team", 0, "month", ["staff_1"]), { code: "BAD_REQUEST" }, "Require enough selections to fit the new capacity")
  await assert.rejects(save("team", 0, "month", ["staff_1", "foreign_staff"]), { code: "BAD_REQUEST" }, "Reject members outside the active bookable team")
  assert.deepEqual(disabledIds, [], "Invalid selections never disable anyone")
  assert.equal(schedule, null, "Invalid selections never schedule a plan change")
  const reduction = await save("team", 0, "month", ["staff_1", "staff_2"])
  assert.deepEqual(disabledIds, ["staff_1", "staff_2"], "Only explicitly selected members stop receiving bookings")
  assert.equal(used, 3)
  assert.equal(reduction.scheduled, true)
  assert.equal(rows[0]!.seats, 3, "Scheduled reductions reserve their lower allowance immediately")
  assert.equal(live.items.data[1]!.quantity, 2, "The paid Stripe quantity remains unchanged until renewal")
  assert.equal(scheduleInput?.phases?.[1]?.start_date, now + 86400 * 30)
  assert.deepEqual(scheduleInput?.phases?.[1]?.items, [{ price: "price_team_month", quantity: 1 }])
  await syncStripeSubscription(live.id)
  assert.equal(rows[0]!.seats, 3, "Reconciliation preserves a scheduled capacity reduction")
  const state = await getBillingPlanState("org_test")
  assert.equal(state.pending?.capacity, 3)
  assert.equal(state.current?.capacity, 5)
  assert.equal(state.trialEligible, false)
  await save("team", 2)
  assert.equal(rows[0]!.seats, 5, "Confirming the current plan cancels the scheduled reduction")
  assert.equal(live.schedule, null)
  await save("team", 2, "year")
  assert.deepEqual(scheduleInput?.phases?.[1]?.items, [{ price: "price_team_year", quantity: 1 }, { price: "price_extra_year", quantity: 2 }])
  assert.equal(scheduleInput?.phases?.[1]?.duration?.interval, "year")
  invalidPrice = true
  await assert.rejects(save("team", 2), { code: "PRECONDITION_FAILED" })
  const { onboardingRouter } = await vite.ssrLoadModule("/app/.server/routers/onboarding.ts") as typeof import("../app/.server/routers/onboarding")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const setupRouter = createTRPCRouter(onboardingRouter)
  let priceLookups = 0
  Object.assign(stripeClient.prices, { retrieve: async () => { priceLookups++; throw Object.assign(new Error("No such price"), { code: "resource_missing" }) } })
  Object.assign(prisma.member, { findFirst: async () => ({ organizationId: "org_test", role: "owner" }) })
  const setupCaller = setupRouter.createCaller({ prisma, headers: new Headers(), organizationId: "org_test", user: { id: "user_test" }, locale: "en" } as unknown as Parameters<typeof setupRouter.createCaller>[0])
  const setup = await setupCaller.subscription()
  assert.equal(setup.billingEnabled, true)
  assert.deepEqual(setup.plans.map((plan) => plan.id), ["solo", "team"])
  assert.equal(priceLookups, 0, "Rendering plan selection must not depend on Stripe price availability")
  customerId = null
  live = null
  rows.length = 0
  const newBusinessPlans = await getBillingPlanState("org_test")
  assert.equal(newBusinessPlans.trialEligible, true)
  assert.equal(newBusinessPlans.plans.length, 2, "The plan selector remains available when configured prices cannot be retrieved")
  assert.equal(priceLookups, 0)
  await assert.rejects(save("solo"), { code: "resource_missing" })
  assert.equal(checkoutCalls, 1, "Invalid Stripe prices still prevent checkout")
  console.info("PASS plan prices, tax setup, checkout, paid upgrades, pending payments, retries, capacity validation, scheduled reductions, annual changes and reconciliation")
} finally {
  await vite.close()
}
