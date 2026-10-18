import { hasOrganizationPermission } from "~/lib/auth/permissions"
import { TRPCError } from "@trpc/server"
import type { Prisma } from "../../../generated/prisma/client"

export type Database = Prisma.TransactionClient

export function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND" })
}

export function slotUnavailable(): never {
  const cause = Object.assign(new Error("Slot unavailable"), { appCode: "SLOT_UNAVAILABLE" })
  throw new TRPCError({ code: "CONFLICT", message: "This time is no longer available", cause })
}

// One tenant lock also covers organization-wide closures, cross-midnight buffers,
// any-staff assignment and customer matching. Keep every scheduling writer on it.
export async function schedulingLock(tx: Database, organizationId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`appointments:${organizationId}`}, 0))::text`
}

export async function assertScope(db: Database, organizationId: string, scope: { staffMemberId?: string | null; locationId?: string | null }) {
  if (scope.staffMemberId && !await db.staffMember.findFirst({ where: { id: scope.staffMemberId, organizationId } })) notFound()
  if (scope.locationId && !await db.location.findFirst({ where: { id: scope.locationId, organizationId } })) notFound()
}

export function isManager(member: { role: string }) {
  return hasOrganizationPermission(member.role, { team: ["manage"] })
}

