import type { ComponentProps } from "react"

import type { BillingNotificationBar } from "~/components/billing/billing-notification-bar"
import type { Profile } from "~/components/navigation/profile"
import type { AppNavigationItem } from "~/lib/routing/app-navigation"
import type { PageLayoutPreference } from "~/lib/routing/page-layout"

export type WorkspaceLayoutProps = {
  animatePage: boolean
  billingNotification: ComponentProps<typeof BillingNotificationBar>["notification"]
  isDesktop: boolean
  isElectron: boolean
  isViewportPage: boolean
  menuItems: readonly AppNavigationItem[]
  pageLayout: PageLayoutPreference
  pendingPath?: string
  routePathname: string
  user: ComponentProps<typeof Profile>["user"]
}
