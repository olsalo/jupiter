import { prisma } from "~/lib/prisma.server"
import {
  entitledSubscriptionStatuses,
  isSubscriptionEntitled,
  type SubscriptionEntitlement,
} from "~/lib/billing"

export async function getActiveOrganizationSubscription({
  organizationId,
}: {
  organizationId: string
}) {
  const subscriptions = await prisma.subscription.findMany({
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
      isSubscriptionEntitled(subscription as SubscriptionEntitlement),
    ) ?? null
  )
}

export async function hasActiveOrganizationSubscription({
  organizationId,
}: {
  organizationId: string
}) {
  return Boolean(await getActiveOrganizationSubscription({ organizationId }))
}
