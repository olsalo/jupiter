import Stripe from "stripe"

import type { BillingInterval } from "~/lib/billing/billing"
import type { PlanId } from "~/lib/billing/plans"

export const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

const stripePriceIds: Record<PlanId, Record<BillingInterval, string | undefined>> = {
  solo: {
    month: process.env.STRIPE_SOLO_PRICE_ID,
    year: process.env.STRIPE_SOLO_ANNUAL_PRICE_ID,
  },
  team: {
    month: process.env.STRIPE_TEAM_PRICE_ID,
    year: process.env.STRIPE_TEAM_ANNUAL_PRICE_ID,
  },
}

export const stripeExtraStaffPriceIds = {
  month: process.env.STRIPE_EXTRA_STAFF_PRICE_ID,
  year: process.env.STRIPE_EXTRA_STAFF_ANNUAL_PRICE_ID,
}

export const stripeBillingEnabled = Boolean(stripeClient && process.env.STRIPE_WEBHOOK_SECRET && stripePriceIds.solo.month && stripePriceIds.team.month && stripeExtraStaffPriceIds.month)
export const stripeAnnualBillingEnabled = Boolean(stripePriceIds.solo.year && stripePriceIds.team.year && stripeExtraStaffPriceIds.year)

export function getPlanForPrice(priceId: string) {
  for (const planId of ["solo", "team"] as const) {
    for (const interval of ["month", "year"] as const) {
      if (stripePriceIds[planId][interval] === priceId) return { planId, interval }
    }
  }
  return null
}

export function getStripePriceId(planId: PlanId, interval: BillingInterval) {
  return stripePriceIds[planId][interval]
}
