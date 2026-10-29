import type { AppIconName } from "~/components/icons"
import { hasOrganizationPermission, type OrganizationPermissions } from "~/lib/auth/permissions"

export const settingsItems = [
  { id: "profile", icon: "user", labelKey: "settings.profile", descriptionKey: "settings.profileDescription", permissions: null },
  { id: "sessions", icon: "lock", labelKey: "settings.sessions", descriptionKey: "settings.sessionsDescription", permissions: null },
  { id: "business", icon: "buildingStore", labelKey: "settings.business", descriptionKey: "settings.generalDescription", permissions: { business: ["configure"] } },
  { id: "booking", icon: "calendarEvent", labelKey: "settings.booking", descriptionKey: "settings.bookingDescription", permissions: { bookingSettings: ["configure"] } },
  { id: "communications", icon: "mail", labelKey: "settings.communications", descriptionKey: "settings.communicationsDescription", permissions: { communications: ["configure"] } },
  { id: "billing", icon: "creditCard", labelKey: "settings.billing", descriptionKey: "settings.billingDescription", permissions: { billing: ["manage"] } },
] as const satisfies readonly {
  id: string
  icon: AppIconName
  labelKey: string
  descriptionKey: string
  permissions: OrganizationPermissions | null
}[]

export type SettingsItemId = (typeof settingsItems)[number]["id"]

export function getVisibleSettingsItems(role: string | null | undefined) {
  return settingsItems.filter((item) => !item.permissions || hasOrganizationPermission(role, item.permissions))
}

export function isSettingsHash(hash: string) {
  return hash === "#settings" || hash.startsWith("#settings/")
}

export function getSettingsItemIdFromHash(hash: string, role: string | null | undefined): SettingsItemId | null {
  if (!isSettingsHash(hash)) return null
  const requestedItem = hash.slice("#settings/".length).replace(/\/$/, "")
  const itemId = requestedItem === "general" ? "business" : requestedItem === "notifications" ? "communications" : requestedItem === "appearance" ? "profile" : requestedItem
  return getVisibleSettingsItems(role).find((item) => item.id === itemId)?.id ?? "profile"
}

// Preference redirects accept known settings links only, never arbitrary fragments
export function getSafeSettingsHash(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return ""
  return /^#settings(?:\/(?:profile|sessions|business|locations|booking|communications|billing|general|notifications|appearance))?\/?$/.test(value) ? value : ""
}
