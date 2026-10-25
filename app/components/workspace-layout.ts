import type { ComponentProps } from "react"

import type { BillingNotificationBar } from "~/components/billing-notification-bar"
import type { Profile } from "~/components/profile"
import type { AppNavigationItem } from "~/lib/app-navigation"
import type { PageLayoutPreference } from "~/lib/page-layout"

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
