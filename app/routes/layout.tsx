import { useLayoutEffect, useRef, useState } from "react"
import {
  Navigate,
  redirect,
  useLocation,
  useMatches,
  useNavigation,
} from "react-router"

import type { Route } from "./+types/layout"
import { ClassicLayout } from "~/components/layout/classic-layout"
import { FloatingLayout } from "~/components/layout/floating-layout"
import { WelcomeDialog } from "~/components/overview/welcome-dialog"
import { appNavigationItems } from "~/lib/routing/app-navigation"
import { getRoutePermissions, hasOrganizationPermission } from "~/lib/auth/permissions"
import { stripeBillingEnabled } from "~/lib/auth/server"
import { useAppContext } from "~/lib/hooks/use-app-context"
import { useMediaQuery } from "~/lib/hooks"
import { desktopViewportQuery } from "~/lib/routing/mobile-navigation"
import { resolvePageLayout, type PageLayoutPreference } from "~/lib/routing/page-layout"
import { shouldRevalidateWorkspaceRoute } from "~/lib/routing/should-revalidate"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import { useCurrentOrganizationRole } from "~/lib/hooks/use-organization-access"
import {
  requireAuthMiddleware,
  requireOrganizationMiddleware,
  requireRoutePermissionsMiddleware,
  organizationMiddleware,
  organizationContext,
  membershipContext,
} from "~/middleware/auth"

type LayoutRouteHandle = {
  workspace?: boolean
  pageLayout?: PageLayoutPreference
  overlay?: boolean
}

export const middleware: Route.MiddlewareFunction[] = [
  requireAuthMiddleware,
  organizationMiddleware,
  requireOrganizationMiddleware,
  requireRoutePermissionsMiddleware,
]

export async function loader(args: Route.LoaderArgs) {
  const trpc = await createTRPC(args)
  const status = await getQueryClient().query(trpc.onboarding.status.queryOptions())
  if (!status.setupComplete || (status.billingEnabled && !status.subscriptionComplete && !status.demoOnboardingPaymentBypassEnabled)) {
    throw redirect("/onboarding")
  }
  const appContext = await getQueryClient().query(trpc.profile.getAppContext.queryOptions())
  return {
    ...appContext,
    org: args.context.get(organizationContext),
    staffProfile: args.context.get(membershipContext)?.staffProfile ?? null,
    billingEnabled: stripeBillingEnabled,
    billingAnnualEnabled: Boolean(process.env.STRIPE_PRO_ANNUAL_PRICE_ID),
  }
}

export const shouldRevalidate = shouldRevalidateWorkspaceRoute

export default function Layout() {
  const rootData = useAppContext()
  const location = useLocation()
  const matches = useMatches()
  const navigation = useNavigation()
  const organizationRole = useCurrentOrganizationRole()

  const workspaceMatch = matches.find((match) => (match.handle as LayoutRouteHandle | undefined)?.workspace)
  const workspaceHandle = workspaceMatch?.handle as LayoutRouteHandle | undefined
  const pagePathname = workspaceMatch?.pathname ?? location.pathname
  const pageLayout = workspaceHandle?.pageLayout ?? "scroll"
  const isOverlayRoute = matches.some((match) => (match.handle as LayoutRouteHandle | undefined)?.overlay)

  const isMobile = useMediaQuery("max-768px")
  const isDesktop = useMediaQuery(desktopViewportQuery, { serverMatches: true })
  const isViewportPage = resolvePageLayout(pageLayout, isMobile) === "viewport"

  const menuItems = appNavigationItems.filter((item) => {
    const permissions = getRoutePermissions(item.path)
    return !permissions || hasOrganizationPermission(organizationRole, permissions)
  })
  const pendingPathname = navigation.state !== "idle" ? navigation.location?.pathname : undefined
  const pendingPath = menuItems.find((item) => pendingPathname === item.path || pendingPathname?.startsWith(`${item.path}/`))?.path
  const routePermissions = getRoutePermissions(location.pathname)

  const previousPathname = useRef(pagePathname)
  const [animatedPathname, setAnimatedPathname] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (previousPathname.current !== pagePathname) {
      previousPathname.current = pagePathname
      setAnimatedPathname(isOverlayRoute ? null : pagePathname)
    } else if (isOverlayRoute) {
      setAnimatedPathname(null)
    }
  }, [isOverlayRoute, pagePathname])

  if (organizationRole && routePermissions && !hasOrganizationPermission(organizationRole, routePermissions)) {
    return <Navigate replace={true} to="/calendar" />
  }

  const layoutProps = {
    animatePage: !isOverlayRoute && animatedPathname === pagePathname,
    billingNotification: rootData?.billingNotification,
    isDesktop,
    isElectron: Boolean(rootData?.isElectron),
    isViewportPage,
    menuItems,
    pageLayout,
    pendingPath,
    routePathname: pagePathname,
    user: rootData?.user ?? null,
  }

  return (
    <>
      <WelcomeDialog />
      {import.meta.env.APP_LAYOUT_STYLE === "floating"
        ? <FloatingLayout {...layoutProps} />
        : <ClassicLayout {...layoutProps} isMobile={isMobile} />}
    </>
  )
}
