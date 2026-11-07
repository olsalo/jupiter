import type { LimitResource, ResourceLimitDatabase } from "./types"

type CountResource = (db: ResourceLimitDatabase, organizationId: string) => Promise<number>

export const resourceLimitRegistry = {
  teamMembers: (db, organizationId) => db.staffMember.count({ where: { organizationId, isActive: true, acceptsAppointments: true } }),
} satisfies Record<LimitResource, CountResource>
