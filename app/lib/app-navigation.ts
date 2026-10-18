import type { AppIconName } from "~/components/icons"

export type AppNavigationItem = {
  activeIcon?: AppIconName
  icon: AppIconName
  labelKey: "nav.team" | "nav.calendar" | "nav.customers" | "nav.services" | "nav.bookingPage"
  path: "/team-v2" | "/calendar" | "/customers" | "/services" | "/booking-pages"
}

export const appNavigationItems: AppNavigationItem[] = [
  { icon: "calendar", labelKey: "nav.calendar", path: "/calendar" },
  { icon: "user", labelKey: "nav.customers", path: "/customers" },
  { icon: "forms", labelKey: "nav.services", path: "/services" },
  { icon: "share", labelKey: "nav.bookingPage", path: "/booking-pages" },
  { icon: "users", labelKey: "nav.team", path: "/team-v2" },
]
