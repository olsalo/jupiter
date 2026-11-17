import { Temporal } from "@js-temporal/polyfill"
import type { Prisma } from "../../../generated/prisma/client.ts"
import { getPlanAmount } from "./plans.ts"

// Local fixtures are available only to the barber seed, never to Stripe customers.
export async function getSeededBilling(db: Pick<Prisma.TransactionClient, "organization" | "subscription">, organizationId: string) {
  if (process.env.NODE_ENV === "production") return null
  const organization = await db.organization.findUnique({ where: { id: organizationId }, select: { metadata: true, stripeCustomerId: true } })
  if (organization?.metadata !== "jupiter-barber-v1" || organization.stripeCustomerId) return null
  const subscription = await db.subscription.findUnique({ where: { id: `barber_seed_${organizationId}` } })
  if (!subscription || subscription.referenceId !== organizationId || subscription.stripeSubscriptionId || subscription.status !== "active" || subscription.cancelAt || subscription.cancelAtPeriodEnd || subscription.endedAt) return null
  const planId: "solo" | "team" = subscription.plan === "solo" ? "solo" : "team"
  const interval: "month" | "year" = subscription.billingInterval === "year" ? "year" : "month"
  const capacity = subscription.seats ?? (planId === "solo" ? 1 : 3)
  const extraStaff = planId === "team" ? Math.max(0, capacity - 3) : 0
  const amount = getPlanAmount(planId, interval, extraStaff)
  const start = Temporal.Instant.fromEpochMilliseconds((subscription.periodStart ?? new Date()).getTime()).toZonedDateTimeISO("Europe/Helsinki")
  const period = interval === "year" ? { years: 1 } : { months: 1 }
  const nextDate = subscription.periodEnd ?? new Date(start.add(period).epochMilliseconds)
  const taxAmount = Math.round(amount * 0.255)
  return {
    current: { planId, interval, capacity, extraStaff },
    paymentMethods: [
      { id: `seed_visa_${organizationId}`, brand: "visa", last4: "4242", expMonth: 12, expYear: start.year + 3, isDefault: true, status: "default" as const },
      { id: `seed_mastercard_${organizationId}`, brand: "mastercard", last4: "4444", expMonth: 8, expYear: start.year + 2, isDefault: false, status: "active" as const },
    ],
    invoices: [0, 1, 2].map((index) => ({
      id: `seed_invoice_${organizationId}_${index}`,
      number: `DEMO-${start.year}-${String(3 - index).padStart(3, "0")}`,
      amount, currency: "eur", taxAmount, status: "paid", isTrial: false,
      plan: `Jupiter ${planId === "team" ? "Team" : "Solo"}`,
      date: new Date(start.subtract(interval === "year" ? { years: index } : { months: index }).epochMilliseconds).toISOString(),
      url: null,
    })),
    nextCharge: { amount, currency: "eur", taxAmount, date: nextDate },
  }
}
