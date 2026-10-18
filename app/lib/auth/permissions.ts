import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access"

export const organizationStatements = {
  ...defaultStatements,
  appointments: ["read", "create", "update"],
  customers: ["read", "create", "update"],
  availability: ["own", "manage"],
  services: ["configure"],
  team: ["manage"],
  bookingPage: ["configure"],
  business: ["configure"],
  locations: ["configure"],
  bookingSettings: ["configure"],
  communications: ["configure"],
  billing: ["manage"],
} as const

export const organizationAccessControl = createAccessControl(organizationStatements)

const operatingPermissions = {
  appointments: ["read", "create", "update"],
  customers: ["read", "create", "update"],
  availability: ["own"],
} as const

const configurationPermissions = {
  ...operatingPermissions,
  availability: ["own", "manage"],
  services: ["configure"],
  team: ["manage"],
  bookingPage: ["configure"],
  business: ["configure"],
  locations: ["configure"],
  bookingSettings: ["configure"],
  communications: ["configure"],
} as const

export const organizationRoles = {
  member: organizationAccessControl.newRole({ ...memberAc.statements, ...operatingPermissions }),
  admin: organizationAccessControl.newRole({ ...adminAc.statements, ...configurationPermissions }),
  owner: organizationAccessControl.newRole({ ...ownerAc.statements, ...configurationPermissions, billing: ["manage"] }),
}

export type OrganizationRole = keyof typeof organizationRoles
export type OrganizationPermissions = {
  [Resource in keyof typeof organizationStatements]?: readonly (typeof organizationStatements[Resource][number])[]
}

export function hasOrganizationPermission(role: string | null | undefined, permissions: OrganizationPermissions) {
  return role?.split(",").some((value) => {
    const name = value.trim()
    return (name === "owner" || name === "admin" || name === "member") &&
      organizationRoles[name].authorize(permissions).success
  }) ?? false
}

export function isBookableStaff(staff: { isActive: boolean; acceptsAppointments: boolean } | null | undefined) {
  return staff?.isActive === true && staff.acceptsAppointments === true
}

export function canAccessAvailability(
  member: { role: string; staffProfile: { id: string; isActive: boolean; acceptsAppointments: boolean } | null },
  staffMemberId: string | null | undefined,
) {
  return hasOrganizationPermission(member.role, { availability: ["manage"] }) ||
    (hasOrganizationPermission(member.role, { availability: ["own"] }) &&
      isBookableStaff(member.staffProfile) && Boolean(staffMemberId) && staffMemberId === member.staffProfile?.id)
}

export function getRoutePermissions(pathname: string): OrganizationPermissions | null {
  const area = pathname.split("/")[1]
  switch (area) {
    case "services": return { services: ["configure"] }
    case "team":
    case "team-v2": return { team: ["manage"] }
    case "booking-pages": return { bookingPage: ["configure"] }
    case "calendar": return { appointments: ["read"] }
    case "customers": return { customers: ["read"] }
    default: return null
  }
}
