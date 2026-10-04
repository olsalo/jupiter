import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hasOrganizationRole(
  role: string | null | undefined,
  expectedRole: string,
) {
  return role?.split(",").some((value) => value.trim() === expectedRole) ?? false
}

export function hasOwnerRole(role: string | null | undefined) {
  return hasOrganizationRole(role, "owner")
}
