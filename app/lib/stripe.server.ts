import Stripe from "stripe"

import type { BillingInterval } from "~/lib/billing"
import type { PlanId } from "~/lib/plans"

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

const stripePriceIds: Record<PlanId, Record<BillingInterval, string | undefined>> = {
  pro: {
    month: process.env.STRIPE_PRO_PRICE_ID,
    year: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  },
}

export type StripePriceData = {
  currency: string
  unitAmount: number | null
}

export function getStripePriceId(planId: PlanId, interval: BillingInterval) {
  return stripePriceIds[planId][interval]
}

export async function getStripePrice(
  priceId: string | undefined,
): Promise<StripePriceData | null> {
  if (!stripeClient || !priceId) {
    return null
  }

  const price = await stripeClient.prices.retrieve(priceId)

  return {
    currency: price.currency,
    unitAmount: price.unit_amount,
  }
}
