import { useAppContext } from "~/lib/hooks/use-app-context"
import { hasOrganizationPermission, type OrganizationPermissions } from "~/lib/auth/permissions"
import { hasOrganizationRole } from "~/lib/utils"

import type { OrganizationRole } from "~/lib/auth/permissions"
export type { OrganizationRole } from "~/lib/auth/permissions"

export function useCurrentOrganizationRole(): OrganizationRole | null {
  const root = useAppContext()
  const role = root?.organizations?.find(
    (organization) => organization.id === root.org?.id,
  )?.role

  if (hasOrganizationRole(role, "owner")) return "owner"
  if (hasOrganizationRole(role, "admin")) return "admin"
  if (hasOrganizationRole(role, "member")) return "member"

  return null
}

export function useOrganizationPermission(permissions: OrganizationPermissions) {
  const role = useCurrentOrganizationRole()
  const root = useAppContext()
  const requiresWrite = Object.entries(permissions).some(([resource, actions]) => resource !== "billing" && actions.some((action: string) => action !== "read"))
  return !(root.subscriptionReadOnly && requiresWrite) && hasOrganizationPermission(role, permissions)
}

export function useOrganizationRolePermission(permissions: OrganizationPermissions) {
  return hasOrganizationPermission(useCurrentOrganizationRole(), permissions)
}
