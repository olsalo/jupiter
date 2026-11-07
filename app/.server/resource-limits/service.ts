import { LIMIT_RESOURCES } from "./config"
import { isPlanId, getPlan } from "~/lib/billing/plans"
import { isBillingEnforced, isDemoPlan, isDemoSubscriptionAllowed } from "~/lib/billing/billing.server"
import { isSubscriptionEntitled } from "~/lib/billing/billing"
import { ResourceLimitError } from "./errors"
import { resourceLimitRegistry } from "./registry"
import type { LimitResource, ResourceLimitDatabase, ResourceLimitStatus } from "./types"

export function createResourceLimits(db: ResourceLimitDatabase) {
  async function get(organizationId: string, resource: LimitResource): Promise<ResourceLimitStatus> {
    const used = await resourceLimitRegistry[resource](db, organizationId)
    const subscriptions = await db.subscription.findMany({ where: { referenceId: organizationId, status: { in: ["active", "trialing", "past_due"] } }, orderBy: { periodEnd: "desc" } })
    const entitled = subscriptions.filter((item) => (isPlanId(item.plan) || isDemoPlan(item.plan)) && isDemoSubscriptionAllowed(item) && isSubscriptionEntitled(item))
    const subscription = entitled.find((item) => !isDemoPlan(item.plan)) ?? entitled[0]
    const limit = subscription && isPlanId(subscription.plan)
      ? subscription.seats ?? getPlan(subscription.plan).includedStaff
      : subscription && isDemoPlan(subscription.plan) ? subscription.seats ?? 3
      : isBillingEnforced() ? 0 : 1003
    return { used, limit, remaining: Math.max(0, limit - used), reached: used >= limit }
  }

  return {
    get,
    async assert(organizationId: string, resource: LimitResource, additional = 1) {
      const status = await get(organizationId, resource)
      if (status.used + additional > status.limit) throw new ResourceLimitError(resource, status.limit)
    },
    async getAll(organizationId: string) {
      const resources = LIMIT_RESOURCES
      const entries = await Promise.all(resources.map(async (resource) => [resource, await get(organizationId, resource)] as const))
      return Object.fromEntries(entries) as Record<LimitResource, ResourceLimitStatus>
    },
  }
}
