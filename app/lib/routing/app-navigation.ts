import type { AppIconName } from "~/components/icons"

export type AppNavigationItem = {
  activeIcon?: AppIconName
  icon: AppIconName
  labelKey: "nav.team" | "nav.calendar" | "nav.customers" | "nav.services" | "nav.bookingPage"
  path: "/team" | "/calendar" | "/customers" | "/services" | "/booking-page"
}

export const appNavigationItems: AppNavigationItem[] = [
  { icon: "calendar", labelKey: "nav.calendar", path: "/calendar" },
  { icon: "user", labelKey: "nav.customers", path: "/customers" },
  { icon: "forms", labelKey: "nav.services", path: "/services" },
  { icon: "share", labelKey: "nav.bookingPage", path: "/booking-page" },
  { icon: "users", labelKey: "nav.team", path: "/team" },
]
