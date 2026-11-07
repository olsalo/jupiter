import type Stripe from "stripe"
import { TRPCError } from "@trpc/server"
import { prisma } from "~/lib/database/prisma.server"
import { generateId } from "~/lib/database/id"
import { schedulingLock, type Database } from "~/.server/services/scheduling"
import { getPlan, getPlanCapacity, plans, extraStaffPrice } from "./plans"
import { getPlanForPrice, getStripePriceId, stripeAnnualBillingEnabled, stripeBillingEnabled, stripeClient, stripeExtraStaffPriceIds } from "./stripe.server"
import type { BillingPlanInput } from "~/lib/schemas/billing"
import { isDemoMode, isDemoPlan } from "./billing.server"
import { isSubscriptionEntitled } from "./billing"

export function readStripePlan(subscription: Stripe.Subscription) {
  const base = subscription.items.data.find((item) => getPlanForPrice(item.price.id))
  const match = base && getPlanForPrice(base.price.id)
  if (!base || !match) throw new Error("Subscription has no recognized Jupiter plan")
  const extra = subscription.items.data.find((item) => item.price.id === stripeExtraStaffPriceIds[match.interval])
  const extraStaff = match.planId === "team" ? extra?.quantity ?? 0 : 0
  return { ...match, base, extra, extraStaff, capacity: getPlanCapacity(match.planId, extraStaff) }
}

function readPhase(phase: Stripe.SubscriptionSchedule.Phase) {
  const base = phase.items.find((item) => getPlanForPrice(typeof item.price === "string" ? item.price : item.price.id))
  const match = base && getPlanForPrice(typeof base.price === "string" ? base.price : base.price.id)
  if (!match) return null
  const extra = phase.items.find((item) => (typeof item.price === "string" ? item.price : item.price.id) === stripeExtraStaffPriceIds[match.interval])
  const extraStaff = match.planId === "team" ? extra?.quantity ?? 0 : 0
  return { ...match, extraStaff, capacity: getPlanCapacity(match.planId, extraStaff), effectiveAt: new Date(phase.start_date * 1000) }
}

async function scheduledChange(subscription: Stripe.Subscription) {
  if (!stripeClient || !subscription.schedule) return null
  const schedule = typeof subscription.schedule === "string" ? await stripeClient.subscriptionSchedules.retrieve(subscription.schedule) : subscription.schedule
  if (schedule.status !== "active" && schedule.status !== "not_started") return null
  const next = schedule.phases.find((phase) => phase.start_date > Math.floor(Date.now() / 1000))
  return next ? readPhase(next) : null
}

// Always read the latest Stripe state: webhook delivery order is not guaranteed
export async function syncStripeSubscription(subscriptionId: string) {
  if (!stripeClient) return
  const initial = await stripeClient.subscriptions.retrieve(subscriptionId)
  if (!initial.items.data.some((item) => getPlanForPrice(item.price.id))) return
  const customerId = typeof initial.customer === "string" ? initial.customer : initial.customer.id
  const organization = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } })
  if (!organization) return
  await prisma.$transaction(async (tx) => {
    await schedulingLock(tx, organization.id)
    const latest = await stripeClient!.subscriptions.retrieve(subscriptionId)
    await persistSubscription(tx, organization.id, latest)
  }, { timeout: 30000 })
}

async function persistSubscription(db: Database, organizationId: string, subscription: Stripe.Subscription) {
  const current = readStripePlan(subscription)
  const pending = await scheduledChange(subscription)
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
  const data = {
    plan: current.planId,
    referenceId: organizationId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    billingInterval: current.interval,
    // Reserve a scheduled reduction now so staff cannot refill places being removed
    seats: Math.min(current.capacity, pending?.capacity ?? current.capacity),
    periodStart: new Date(current.base.current_period_start * 1000),
    periodEnd: new Date(current.base.current_period_end * 1000),
    trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
    stripeScheduleId: typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id ?? null,
  }
  const existing = await db.subscription.findFirst({ where: { referenceId: organizationId, OR: [{ stripeSubscriptionId: subscription.id }, ...(subscription.metadata.subscriptionId ? [{ id: subscription.metadata.subscriptionId }] : [])] } })
  if (existing) await db.subscription.update({ where: { id: existing.id }, data })
  else await db.subscription.create({ data: { id: generateId(), ...data } })
  return { ...current, pending }
}

export async function reconcileOrganizationBilling(organizationId: string) {
  if (!stripeBillingEnabled || !stripeClient) return null
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { stripeCustomerId: true } })
  if (!organization?.stripeCustomerId) return 0
  const subscriptions = await stripeClient.subscriptions.list({ customer: organization.stripeCustomerId, status: "all", limit: 100 })
  for (const subscription of subscriptions.data) {
    if (subscription.items.data.some((item) => getPlanForPrice(item.price.id))) await syncStripeSubscription(subscription.id)
  }
  return subscriptions.data.length
}

export async function getBillingPlanState(organizationId: string) {
  const demoMode = isDemoMode()
  const previousSubscriptions = demoMode ? 0 : await reconcileOrganizationBilling(organizationId)
  const subscriptions = await prisma.subscription.findMany({ where: { referenceId: organizationId, status: { in: ["active", "trialing", "past_due"] } }, orderBy: { periodEnd: "desc" } })
  const active = subscriptions.find((item) => !isDemoPlan(item.plan) && !item.endedAt && (!item.periodEnd || item.periodEnd > new Date()))
  const demo = demoMode ? subscriptions.find((item) => isDemoPlan(item.plan) && isSubscriptionEntitled(item)) : undefined
  let current: { planId: "solo" | "team"; interval: "month" | "year"; extraStaff: number; capacity: number } | null = null
  let pending: Awaited<ReturnType<typeof scheduledChange>> = null
  let paymentPending = false
  let paymentUrl: string | null = null
  if (demo) {
    const planId = demo.plan === "demo_solo" ? "solo" : "team"
    const capacity = demo.seats ?? (planId === "solo" ? 1 : 3)
    current = { planId, interval: demo.billingInterval === "year" ? "year" : "month", capacity, extraStaff: planId === "team" ? Math.max(0, capacity - 3) : 0 }
  }
  if (!demoMode && stripeBillingEnabled && stripeClient && active?.stripeSubscriptionId) {
    await syncStripeSubscription(active.stripeSubscriptionId)
    const subscription = await stripeClient.subscriptions.retrieve(active.stripeSubscriptionId, { expand: ["latest_invoice"] })
    const state = readStripePlan(subscription)
    current = { planId: state.planId, interval: state.interval, extraStaff: state.extraStaff, capacity: state.capacity }
    pending = await scheduledChange(subscription)
    paymentPending = Boolean(subscription.pending_update)
    const invoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null
    paymentUrl = paymentPending ? invoice?.hosted_invoice_url ?? null : null
  }
  return {
    plans: plans.map((plan) => ({ ...plan })),
    annualEnabled: demoMode || stripeAnnualBillingEnabled,
    billingEnabled: demoMode || stripeBillingEnabled,
    trialEligible: previousSubscriptions === 0,
    used: await prisma.staffMember.count({ where: { organizationId, isActive: true, acceptsAppointments: true } }),
    current,
    pending,
    paymentPending,
    paymentUrl,
  }
}

async function targetItems(input: BillingPlanInput) {
  if (!stripeClient || !stripeBillingEnabled || (input.interval === "year" && !stripeAnnualBillingEnabled)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing is not configured" })
  const plan = getPlan(input.planId)
  const baseId = getStripePriceId(input.planId, input.interval)
  const extraId = stripeExtraStaffPriceIds[input.interval]
  if (!baseId || !extraId) throw new TRPCError({ code: "PRECONDITION_FAILED" })
  const check = async (id: string, amount: number) => {
    const price = await stripeClient!.prices.retrieve(id)
    if (!price.active || price.currency !== "eur" || price.unit_amount !== amount || price.recurring?.interval !== input.interval || price.recurring.interval_count !== 1 || price.tax_behavior !== "exclusive" || price.recurring.usage_type !== "licensed") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe price does not match the Jupiter plan" })
    }
  }
  await Promise.all([check(baseId, input.interval === "year" ? plan.annualAmount : plan.monthlyAmount), check(extraId, extraStaffPrice[input.interval])])
  return [{ price: baseId, quantity: 1 }, ...(input.planId === "team" && input.extraStaff > 0 ? [{ price: extraId, quantity: input.extraStaff }] : [])]
}

async function fitBookableMembers(tx: Database, organizationId: string, input: BillingPlanInput) {
  const where = { organizationId, isActive: true, acceptsAppointments: true }
  const used = await tx.staffMember.count({ where })
  const ids = [...new Set(input.disableStaffIds ?? [])]
  const required = Math.max(0, used - getPlanCapacity(input.planId, input.extraStaff))
  const matched = ids.length ? await tx.staffMember.count({ where: { ...where, id: { in: ids } } }) : 0
  if (ids.length !== required || matched !== ids.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose which members should stop receiving bookings", cause: Object.assign(new Error("capacityTooSmall"), { appCode: "capacityTooSmall", capacityUsed: used }) })
  }
  if (ids.length) await tx.staffMember.updateMany({ where: { ...where, id: { in: ids } }, data: { acceptsAppointments: false } })
}

export async function saveBillingPlan({ organizationId, email, input, returnUrl, cancelUrl, locale }: { organizationId: string; email: string; input: BillingPlanInput; returnUrl: string; cancelUrl: string; locale: "en" | "fi" }) {
  if (isDemoMode()) {
    return prisma.$transaction(async (tx) => {
      await schedulingLock(tx, organizationId)
      const capacity = getPlanCapacity(input.planId, input.extraStaff)
      await fitBookableMembers(tx, organizationId, input)
      const id = `demo_${organizationId}`
      const existing = await tx.subscription.findUnique({ where: { id }, select: { plan: true, referenceId: true } })
      if (existing && (!isDemoPlan(existing.plan) || existing.referenceId !== organizationId)) throw new TRPCError({ code: "CONFLICT" })
      const periodStart = new Date()
      const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000)
      const values = { plan: `demo_${input.planId}`, status: "active", seats: capacity, billingInterval: input.interval, periodStart, periodEnd, cancelAt: null, canceledAt: null, endedAt: null, cancelAtPeriodEnd: false }
      await tx.subscription.upsert({ where: { id }, create: { id, referenceId: organizationId, ...values }, update: values })
      return { url: null, scheduled: false, paymentPending: false }
    })
  }
  const items = await targetItems(input)
  const client = stripeClient!
  return prisma.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    await fitBookableMembers(tx, organizationId, input)
    const organization = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } })
    let customerId = organization.stripeCustomerId
    if (!customerId) {
      const customer = await client.customers.create({ email, name: organization.name, metadata: { customerType: "organization", organizationId } }, { idempotencyKey: `jupiter-customer-${organizationId}` })
      customerId = customer.id
      await tx.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customerId } })
    }
    // Stripe is authoritative, including a checkout completed before its webhook arrived
    const subscriptions = await client.subscriptions.list({ customer: customerId, status: "all", limit: 100 })
    const subscription = subscriptions.data.find((item) => ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(item.status))
    if (!subscription || subscription.status === "paused") {
      if (subscription) throw new TRPCError({ code: "CONFLICT", message: "Resolve the paused subscription before restarting" })
      const open = await client.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 })
      for (const session of open.data) if (session.mode === "subscription") await client.checkout.sessions.expire(session.id)
      const id = generateId()
      await tx.subscription.create({ data: { id, referenceId: organizationId, stripeCustomerId: customerId, plan: input.planId, seats: getPlanCapacity(input.planId, input.extraStaff), billingInterval: input.interval } })
      const metadata = { subscriptionId: id, referenceId: organizationId }
      const checkout = await client.checkout.sessions.create({
        mode: "subscription", customer: customerId, client_reference_id: organizationId, metadata,
        line_items: items, locale, success_url: returnUrl, cancel_url: cancelUrl,
        automatic_tax: { enabled: true }, billing_address_collection: "required",
        tax_id_collection: { enabled: true }, customer_update: { address: "auto", name: "auto" },
        subscription_data: { metadata, ...(subscriptions.data.length === 0 ? { trial_period_days: 14 } : {}) },
      }, { idempotencyKey: `jupiter-checkout-${id}` })
      return { url: checkout.url, scheduled: false, paymentPending: false }
    }
    if (subscription.status !== "active" && subscription.status !== "trialing") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Resolve the outstanding subscription payment first" })
    if (subscription.cancel_at_period_end || subscription.cancel_at) throw new TRPCError({ code: "CONFLICT", message: "Restart your subscription before changing the plan" })
    if (subscription.pending_update) throw new TRPCError({ code: "CONFLICT", message: "Complete the pending payment first" })
    const current = readStripePlan(subscription)
    const same = current.planId === input.planId && current.interval === input.interval && current.extraStaff === input.extraStaff
    const pending = await scheduledChange(subscription)
    if (same && !pending) {
      await persistSubscription(tx, organizationId, subscription)
      return { url: null, scheduled: false, paymentPending: false }
    }
    if (subscription.schedule) {
      const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id
      await client.subscriptionSchedules.release(scheduleId)
    }
    if (same) {
      await persistSubscription(tx, organizationId, await client.subscriptions.retrieve(subscription.id))
      return { url: null, scheduled: false, paymentPending: false }
    }
    const reduction = getPlanCapacity(input.planId, input.extraStaff) < current.capacity
    const intervalChange = input.interval !== current.interval
    if (reduction || intervalChange) {
      // Apply reductions and billing-cycle changes at renewal, preserving the paid period
      const schedule = await client.subscriptionSchedules.create({ from_subscription: subscription.id }, { idempotencyKey: `jupiter-schedule-${subscription.id}-${subscription.schedule ? (typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id) : current.base.current_period_start}-${input.planId}-${input.interval}-${input.extraStaff}` })
      await client.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release", proration_behavior: "none",
        phases: [
          { start_date: schedule.phases[0]!.start_date, end_date: current.base.current_period_end, items: subscription.items.data.map((item) => ({ price: item.price.id, quantity: item.quantity ?? 1 })), ...(subscription.trial_end && subscription.trial_end > Date.now() / 1000 ? { trial_end: subscription.trial_end } : {}), proration_behavior: "none" },
          { start_date: current.base.current_period_end, items, duration: { interval: input.interval, interval_count: 1 }, proration_behavior: "none" },
        ],
      })
      await persistSubscription(tx, organizationId, await client.subscriptions.retrieve(subscription.id))
      return { url: null, scheduled: true, paymentPending: false }
    }
    const changes: Stripe.SubscriptionUpdateParams.Item[] = [
      { id: current.base.id, ...items[0]! },
      ...(items[1] ? [{ ...(current.extra ? { id: current.extra.id } : {}), ...items[1] }] : current.extra ? [{ id: current.extra.id, deleted: true }] : []),
    ]
    const updated = await client.subscriptions.update(subscription.id, {
      items: changes, proration_behavior: "always_invoice", payment_behavior: "pending_if_incomplete", expand: ["latest_invoice"],
    }, { idempotencyKey: `jupiter-plan-${subscription.id}-${typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id}-${subscription.schedule ?? "none"}-${input.planId}-${input.interval}-${input.extraStaff}` })
    await persistSubscription(tx, organizationId, updated)
    const invoice = typeof updated.latest_invoice === "object" ? updated.latest_invoice : null
    return { url: updated.pending_update ? invoice?.hosted_invoice_url ?? null : null, scheduled: false, paymentPending: Boolean(updated.pending_update) }
  }, { timeout: 60000 })
}

export async function getBillingPortalConfiguration() {
  if (!stripeClient) throw new TRPCError({ code: "PRECONDITION_FAILED" })
  const configurations = await stripeClient.billingPortal.configurations.list({ active: true, limit: 100 })
  const existing = configurations.data.find((item) => item.metadata?.purpose === "jupiter-billing" && !item.features.subscription_update.enabled && item.features.subscription_cancel.mode === "at_period_end")
  if (existing) return existing.id
  const configuration = await stripeClient.billingPortal.configurations.create({ metadata: { purpose: "jupiter-billing" }, features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true }, subscription_cancel: { enabled: true, mode: "at_period_end" }, subscription_update: { enabled: false }, customer_update: { enabled: false } } }, { idempotencyKey: "jupiter-billing-portal-v1" })
  return configuration.id
}

export async function createReadOnlyBillingPortal(organizationId: string, returnUrl: string, locale: "en" | "fi") {
  if (!stripeClient) throw new TRPCError({ code: "PRECONDITION_FAILED" })
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
  if (!organization.stripeCustomerId) throw new TRPCError({ code: "NOT_FOUND" })
  // Plan changes stay in Jupiter so Stripe cannot bypass staff-capacity validation
  const configuration = await getBillingPortalConfiguration()
  return stripeClient.billingPortal.sessions.create({ customer: organization.stripeCustomerId, configuration, locale, return_url: returnUrl })
}
