import { PRO_LIMITS } from "./config"
import { ResourceLimitError } from "./errors"
import { resourceLimitRegistry } from "./registry"
import type { LimitResource, ResourceLimitDatabase, ResourceLimitStatus } from "./types"

export function createResourceLimits(db: ResourceLimitDatabase) {
  async function get(organizationId: string, resource: LimitResource): Promise<ResourceLimitStatus> {
    const used = await resourceLimitRegistry[resource](db, organizationId)
    const limit = PRO_LIMITS[resource]
    return { used, limit, remaining: Math.max(0, limit - used), reached: used >= limit }
  }

  return {
    get,
    // Zero additional places lets a reserved invitation become a member at capacity.
    async assert(organizationId: string, resource: LimitResource, additional = 1) {
      const status = await get(organizationId, resource)
      if (status.used + additional > status.limit) throw new ResourceLimitError(resource, status.limit)
    },
    async getAll(organizationId: string) {
      const resources = Object.keys(PRO_LIMITS) as LimitResource[]
      const entries = await Promise.all(resources.map(async (resource) => [resource, await get(organizationId, resource)] as const))
      return Object.fromEntries(entries) as Record<LimitResource, ResourceLimitStatus>
    },
  }
}
