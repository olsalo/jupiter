import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { hasOrganizationPermission, type OrganizationPermissions } from "~/lib/auth/permissions"
import { hasOrganizationRole } from "~/lib/utils"

import type { OrganizationRole } from "~/lib/auth/permissions"
export type { OrganizationRole } from "~/lib/auth/permissions"

export function useCurrentOrganizationRole(): OrganizationRole | null {
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const role = root?.organizations.find(
    (organization) => organization.id === root.org?.id,
  )?.role

  if (hasOrganizationRole(role, "owner")) return "owner"
  if (hasOrganizationRole(role, "admin")) return "admin"
  if (hasOrganizationRole(role, "member")) return "member"

  return null
}

export function useOrganizationPermission(permissions: OrganizationPermissions) {
  return hasOrganizationPermission(useCurrentOrganizationRole(), permissions)
}
