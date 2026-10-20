import { useQuery } from "@tanstack/react-query"
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import {
  Link,
  NavLink,
  Outlet,
  href,
  useLocation,
  useMatches,
  useNavigation,
  useRouteLoaderData,
} from "react-router"

import type { Route } from "./+types/layout"
import type { loader as rootLoader } from "~/root"
import { AppLogo } from "~/components/app-logo"
import { BillingNotificationBar } from "~/components/billing-notification-bar"
import { FloatingLayout } from "~/components/floating-layout"
import { NavigationIcon } from "~/components/navigation-icon"
import { useMediaQuery } from "~/lib/hooks"
import { resolvePageLayout, type PageLayoutPreference } from "~/lib/page-layout"
import { ServiceCategoryProvider } from "~/components/services/service-category-controls"
import { Profile } from "~/components/profile"
import { SettingsModal } from "~/components/settings-modal"
import { WelcomeDialog } from "~/components/welcome-dialog"
import { ScrollArea } from "~/components/ui/scroll-area"
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { getRoutePermissions, hasOrganizationPermission } from "~/lib/auth/permissions"
import { useCurrentOrganizationRole } from "~/lib/use-organization-access"
import { appNavigationItems } from "~/lib/app-navigation"
import { cn } from "~/lib/utils"
import { desktopViewportQuery } from "~/lib/mobile-navigation"
import { calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { useTRPC } from "~/lib/trpc/client"
import { useBottomScrollFade } from "~/lib/use-bottom-scroll-fade"
import { useRouteScrollRestoration } from "~/lib/use-route-scroll-restoration"
import {
  requireAuthMiddleware,
  requireOrganizationMiddleware,
  requireRoutePermissionsMiddleware,
} from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [
  requireAuthMiddleware,
  requireOrganizationMiddleware,
  requireRoutePermissionsMiddleware,
]

export function loader() {
  return null
}

export function shouldRevalidate() {
  return true
}

const subscribeToDesktopViewport = (onStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(desktopViewportQuery)
  mediaQuery.addEventListener("change", onStoreChange)

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange)
  }
}

const getDesktopViewport = () =>
  window.matchMedia(desktopViewportQuery).matches
const getServerDesktopViewport = () => true
const subscribeToElectron = () => () => {}
const getElectron = () => navigator.userAgent.includes("Electron/")
const getServerElectron = () => false

export default function Layout() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  useQuery({ ...trpc.staff.list.queryOptions(), ...calendarReferenceQueryOptions })
  useQuery({ ...trpc.organizations.getCurrent.queryOptions(), ...calendarReferenceQueryOptions })
  useQuery(trpc.example.count.queryOptions())
  const organizationRole = useCurrentOrganizationRole()
  useQuery({ ...trpc.team.count.queryOptions(), enabled: hasOrganizationPermission(organizationRole, { team: ["manage"] }) })
  const menuItems = appNavigationItems.filter((item) => {
    const permissions = getRoutePermissions(item.path)
    if (permissions && !hasOrganizationPermission(organizationRole, permissions)) return false
    return true
  })
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const location = useLocation()
  const matches = useMatches()
  const notesMatch = matches.find(
    (match) => match.id === "routes/example/example",
  )
  const isNoteModal = matches.some(
    (match) =>
      match.id === "routes/example/note-modal" ||
      match.id === "routes/example/new-note-modal",
  )
  const workspaceMatch = matches.find((match) => (match.handle as { workspace?: boolean } | undefined)?.workspace)
  const isMobile = useMediaQuery("max-768px")
  const pageLayout = (workspaceMatch?.handle as { pageLayout?: PageLayoutPreference } | undefined)?.pageLayout ?? "scroll"
  const isViewportPage = resolvePageLayout(pageLayout, isMobile) === "viewport"
  const isOverlayRoute = isNoteModal || matches.some((match) => (match.handle as { overlay?: boolean } | undefined)?.overlay)
  const pagePathname = workspaceMatch?.pathname ?? notesMatch?.pathname ?? location.pathname
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
  const animatePage = !isOverlayRoute && animatedPathname === pagePathname
  const navigation = useNavigation()
  const pendingPathname =
    navigation.state !== "idle" ? navigation.location?.pathname : undefined
  const pendingPath = menuItems.find((item) => pendingPathname?.startsWith(`${item.path}/`))?.path ?? pendingPathname
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  useRouteScrollRestoration(scrollViewportRef, pagePathname)
  const bottomBlurRef = useRef<HTMLDivElement>(null)
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)
  const [hasVerticalOverflow, setHasVerticalOverflow] = useState(false)
  const user = rootData?.user ?? null
  const isServicesRoute = workspaceMatch?.id === "routes/services/services"
  const CategoryProvider = isServicesRoute ? ServiceCategoryProvider : Fragment
  useBottomScrollFade(scrollViewportRef, bottomBlurRef, isViewportPage)
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopViewport,
    getServerDesktopViewport,
  )
  const navigationPrefetch = isDesktop ? "intent" : "viewport"
  const isElectronFromBrowser = useSyncExternalStore(
    subscribeToElectron,
    getElectron,
    getServerElectron,
  )
  const isElectron = Boolean(rootData?.isElectron) || isElectronFromBrowser
  useEffect(() => {
    const viewport = scrollViewportRef.current

    if (!viewport) return

    const updateScrollOverflow = () => {
      setHasHorizontalOverflow(viewport.scrollWidth > viewport.clientWidth + 1)
      setHasVerticalOverflow(viewport.scrollHeight > viewport.clientHeight + 1)
    }
    const resizeObserver = new ResizeObserver(updateScrollOverflow)
    const content = viewport.querySelector('[data-slot="scroll-area-content"]')

    resizeObserver.observe(viewport)
    if (content) {
      resizeObserver.observe(content)

      for (const child of content.children) {
        resizeObserver.observe(child)
      }
    }

    viewport.addEventListener("scroll", updateScrollOverflow, { passive: true })
    updateScrollOverflow()

    return () => {
      resizeObserver.disconnect()
      viewport.removeEventListener("scroll", updateScrollOverflow)
    }
  }, [pagePathname, isViewportPage])

  if (import.meta.env.VITE_APP_LAYOUT_STYLE === "floating") {
    return (
      <CategoryProvider>
        <WelcomeDialog />
        <FloatingLayout
          animatePage={animatePage}
          billingNotification={rootData?.billingNotification}
          isViewportPage={isViewportPage}
          isDesktop={isDesktop}
          isElectron={isElectron}
          pendingPath={pendingPath}
          menuItems={menuItems}
          routePathname={pagePathname}
          user={user}
        />
      </CategoryProvider>
    )
  }

  return (
    <CategoryProvider>
    <main
      className={cn(
        "classic-layout relative flex h-dvh flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        isElectron && "pt-8",
      )}
      data-electron={isElectron}
    >
      <WelcomeDialog />
      {isElectron ? (
        <div
          aria-hidden="true"
          className="electron-drag absolute inset-x-0 top-0 z-20 h-8"
        />
      ) : null}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden md:p-2 md:pl-0">
        <aside className="hidden w-15 shrink-0 flex-col items-center justify-between px-3 py-1 md:flex">
          <Link
            aria-label={t("nav.overviewHome")}
            className="electron-no-drag flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            draggable={false}
            prefetch="none"
            to={href("/")}
          >
            <AppLogo aria-hidden="true" className="size-6" />
          </Link>

          <nav className="-mx-3 my-3 flex min-h-0 w-[calc(100%+1.5rem)] flex-1 flex-col gap-2 overflow-y-auto px-3 justify-center">
            <TooltipProvider>
              {menuItems.map((item) => (
                <Tooltip key={item.path}>
                  <TooltipTrigger
                    render={
                      <NavLink
                        aria-label={t(item.labelKey)}
                        className={({ isActive }) =>
                          cn(
                            "relative flex shrink-0 aspect-square items-center justify-center rounded-md text-sm transition-[background-color,color] duration-300 ease-out before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-sm before:bg-primary before:content-[''] before:transition-[opacity,scale] before:duration-300 before:ease-out motion-reduce:transition-none motion-reduce:before:transition-none",
                            (pendingPath ? pendingPath === item.path : isActive)
                              ? "bg-[color-mix(in_oklab,var(--sidebar-accent)_97.5%,black)] text-sidebar-accent-foreground before:scale-y-100 before:opacity-100"
                              : "text-muted-foreground before:scale-y-50 before:opacity-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )
                        }
                        draggable={false}
                        end={false}
                        defaultShouldRevalidate={false}
                        prefetch={navigationPrefetch}
                        to={href(item.path)}
                      >
                        {({ isActive }) => (
                          <NavigationIcon
                            active={pendingPath ? pendingPath === item.path : isActive}
                            activeIcon={item.activeIcon}
                            icon={item.icon}
                            size={20}
                          />
                        )}
                      </NavLink>
                    }
                  />
                  <TooltipPopup side="right" sideOffset={8}>
                    {t(item.labelKey)}
                  </TooltipPopup>
                </Tooltip>
              ))}
            </TooltipProvider>
          </nav>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <SettingsModal hashOwner={isDesktop} showTooltip />
            <Profile user={user} />
          </div>
        </aside>

        <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground md:rounded-md md:border md:border-border md:shadow-xs">
          <BillingNotificationBar
            notification={rootData?.billingNotification}
          />
          <ScrollArea
            className="min-h-0 flex-1"
            fill={true}
            scrollFade={false}
            scrollbarClassName={cn(
              "z-20 max-md:hidden",
              (isViewportPage || !hasVerticalOverflow) && "[&[data-orientation=vertical]]:hidden",
              !hasHorizontalOverflow && "[&[data-orientation=horizontal]]:hidden",
            )}
            viewportProps={{
              className: cn("app-page-scroll !overflow-x-hidden", pageLayout === "viewport-desktop" && isMobile && "[overflow-anchor:none]", isViewportPage && "!overflow-y-hidden"),
              ref: scrollViewportRef,
            }}
          >
            <div className={cn("flex min-h-full min-w-0 flex-col", isViewportPage && "h-full min-h-0")}>
              <div className={cn("flex min-w-0 flex-1 flex-col gap-0 p-6 md:min-h-0 md:pt-0 md:px-6", isViewportPage && "min-h-0")}>
                <header className="flex shrink-0 items-start justify-between md:hidden">
                  <Link
                    aria-label={t("nav.overviewHome")}
                    className="electron-no-drag flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                    draggable={false}
                    prefetch="none"
                    to={href("/")}
                  >
                    <AppLogo aria-hidden="true" className="size-5" />
                  </Link>

                  <div className="flex items-center gap-3">
                    <SettingsModal hashOwner={!isDesktop} />
                    <Profile user={user} />
                  </div>
                </header>

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col md:min-h-0",
                    isViewportPage && "min-h-0",
                    animatePage && "route-enter",
                  )}
                  key={`content-${pagePathname}`}
                >
                  <Outlet />
                </div>
              </div>
            </div>
          </ScrollArea>
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-linear-to-t from-background/75 from-50% to-transparent will-change-opacity",
              isViewportPage && "hidden",
            )}
            ref={bottomBlurRef}
          />
        </section>
      </div>

      <nav className="grid h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 auto-cols-fr grid-flow-col place-items-center overflow-hidden border-t border-border bg-background px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
        {menuItems.map((item) => (
          <NavLink
            aria-label={t(item.labelKey)}
            className={({ isActive }) =>
              cn(
                "flex aspect-square w-full max-w-12 items-center justify-center rounded-lg border transition-[background-color,color,border-color,box-shadow] duration-300 ease-out [-webkit-touch-callout:none] motion-reduce:transition-none",
                (pendingPath ? pendingPath === item.path : isActive)
                  ? "border-border bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                  : "border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
            draggable={false}
            end={false}
            key={item.path}
            onContextMenu={(event) => event.preventDefault()}
            defaultShouldRevalidate={false}
            prefetch={navigationPrefetch}
            to={href(item.path)}
          >
            {({ isActive }) => (
              <NavigationIcon
                active={pendingPath ? pendingPath === item.path : isActive}
                activeIcon={item.activeIcon}
                icon={item.icon}
                size={24}
              />
            )}
          </NavLink>
        ))}
      </nav>
    </main>
    </CategoryProvider>
  )
}
