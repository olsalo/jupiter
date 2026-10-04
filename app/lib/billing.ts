export type BillingInterval = "month" | "year"

export const entitledSubscriptionStatuses = [
  "active",
  "past_due",
  "trialing",
] as const

export type SubscriptionEntitlement = {
  cancelAt: Date | null
  cancelAtPeriodEnd: boolean | null
  canceledAt: Date | null
  endedAt: Date | null
  status: string
}

export function isSubscriptionEntitled(
  subscription: SubscriptionEntitlement | null | undefined,
) {
  return Boolean(
    subscription &&
      entitledSubscriptionStatuses.includes(
        subscription.status as (typeof entitledSubscriptionStatuses)[number],
      ) &&
      !subscription.cancelAtPeriodEnd &&
      !subscription.cancelAt &&
      !subscription.canceledAt &&
      !subscription.endedAt,
  )
}

export type BillingNotification =
  | { type: "payment-failed" }
  | { type: "payment-setup-incomplete" }
  | { type: "subscription-inactive" }
  | {
      expMonth: number
      expYear: number
      last4: string | null
      type: "payment-method-expired"
    }
  | {
      expMonth: number
      expYear: number
      last4: string | null
      type: "payment-method-expiring"
    }
  | { type: "payment-method-missing" }
