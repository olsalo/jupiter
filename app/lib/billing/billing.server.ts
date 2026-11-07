import { prisma } from "~/lib/database/prisma.server.ts"
import { TRPCError } from "@trpc/server"
import type { Prisma } from "../../../generated/prisma/client"
import {
  entitledSubscriptionStatuses,
  isSubscriptionEntitled,
  type SubscriptionEntitlement,
} from "~/lib/billing/billing"

export function isBillingEnforced() {
  const enabled = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SOLO_PRICE_ID && process.env.STRIPE_TEAM_PRICE_ID && process.env.STRIPE_EXTRA_STAFF_PRICE_ID)
  return enabled
}

export function isDemoPlan(plan: string) {
  return plan === "demo" || plan === "demo_solo" || plan === "demo_team"
}

export function isDemoMode() {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_BYPASS_ONBOARDING_PAYMENT === "true"
}

export function isDemoSubscriptionAllowed(subscription: { plan: string }) {
  return !isDemoPlan(subscription.plan) || isDemoMode()
}

type SubscriptionDatabase = Pick<Prisma.TransactionClient, "subscription">

export async function assertOrganizationSubscription(organizationId: string, db: SubscriptionDatabase = prisma) {
  if (isBillingEnforced() && !await hasActiveOrganizationSubscription({ organizationId, db })) {
    throw new TRPCError({ code: "FORBIDDEN", message: "An active subscription is required", cause: Object.assign(new Error("subscriptionInactive"), { appCode: "SUBSCRIPTION_INACTIVE" }) })
  }
}

export async function getActiveOrganizationSubscription({
  organizationId,
  db = prisma,
}: {
  organizationId: string
  db?: SubscriptionDatabase
}) {
  const subscriptions = await db.subscription.findMany({
    select: {
      cancelAt: true,
      cancelAtPeriodEnd: true,
      canceledAt: true,
      endedAt: true,
      id: true,
      plan: true,
      periodEnd: true,
      referenceId: true,
      status: true,
      stripeSubscriptionId: true,
    },
    where: {
      referenceId: organizationId,
      status: { in: [...entitledSubscriptionStatuses] },
    },
    orderBy: { periodEnd: "desc" },
  })

  return (
    subscriptions.find((subscription) =>
      isDemoSubscriptionAllowed(subscription) && isSubscriptionEntitled(subscription as SubscriptionEntitlement),
    ) ?? null
  )
}

export async function hasActiveOrganizationSubscription({
  organizationId,
  db = prisma,
}: {
  organizationId: string
  db?: SubscriptionDatabase
}) {
  return Boolean(await getActiveOrganizationSubscription({ organizationId, db }))
}
