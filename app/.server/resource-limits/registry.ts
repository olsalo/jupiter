import type { LimitResource, ResourceLimitDatabase } from "./types"

type CountResource = (db: ResourceLimitDatabase, organizationId: string) => Promise<number>

export const resourceLimitRegistry = {
  teamMembers: async (db, organizationId) => {
    // Linked profiles and their invitations already belong to a counted person.
    const counts = await Promise.all([
      db.member.count({ where: { organizationId } }),
      db.staffMember.count({ where: { organizationId, memberId: null } }),
      db.invitation.count({ where: { organizationId, staffMemberId: null, status: "pending", expiresAt: { gt: new Date() } } }),
    ])
    return counts.reduce((total, count) => total + count, 0)
  },
} satisfies Record<LimitResource, CountResource>
