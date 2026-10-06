import { useQuery } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import {
  Link,
  NavLink,
  Outlet,
  href,
  useLocation,
  useMatches,
  useNavigate,
  useNavigation,
  useRouteLoaderData,
} from "react-router"

import type { Route } from "./+types/layout"
import type { loader as rootLoader } from "~/root"
import { AppLogo } from "~/components/app-logo"
import { BillingNotificationBar } from "~/components/billing-notification-bar"
import { FloatingLayout } from "~/components/floating-layout"
import Icon, { type AppIconName } from "~/components/icons"
import { NavigationIcon } from "~/components/navigation-icon"
import { PageHeader } from "~/components/page-header"
import { Profile } from "~/components/profile"
import { SettingsModal } from "~/components/settings-modal"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import {
  Tooltip,
  TooltipPopup,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"
import { desktopViewportQuery } from "~/lib/mobile-navigation"
import { useTRPC } from "~/lib/trpc/client"
import { useBottomScrollFade } from "~/lib/use-bottom-scroll-fade"
import { useRouteScrollRestoration } from "~/lib/use-route-scroll-restoration"
import { useOverviewGreeting } from "~/lib/use-overview-greeting"
import {
  requireAuthMiddleware,
  requireOrganizationMiddleware,
} from "~/middleware/auth"

export const middleware: Route.MiddlewareFunction[] = [
  requireAuthMiddleware,
  requireOrganizationMiddleware,
]

const menuItems: Array<{
  activeIcon?: AppIconName
  icon: AppIconName
  labelKey: "nav.overview" | "nav.notes" | "nav.team"
  path: "/" | "/example" | "/team"
}> = [
  {
    activeIcon: "dashboard",
    icon: "dashboard",
    labelKey: "nav.overview",
    path: "/",
  },
  {
    icon: "notes",
    labelKey: "nav.notes",
    path: "/example",
  },
  {
    icon: "users",
    labelKey: "nav.team",
    path: "/team",
  },
]

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

type PageHeaderData = {
  actionHref?: string
  actionLabel?: string
  description?: string
  refreshing?: boolean
  title?: string
}

export default function Layout() {
  const { t } = useTranslation()
  const overviewGreeting = useOverviewGreeting()
  const trpc = useTRPC()
  useQuery(trpc.example.count.queryOptions())
  useQuery(trpc.team.count.queryOptions())
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const location = useLocation()
  const matches = useMatches()
  const notesMatch = matches.find(
    (match) => match.id === "routes/example",
  )
  const isNoteModal = matches.some(
    (match) =>
      match.id === "routes/example-note-modal" ||
      match.id === "routes/example-new-note-modal",
  )
  const isOverlayRoute = isNoteModal
  const pagePathname = notesMatch?.pathname ?? location.pathname
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
  const navigate = useNavigate()
  const navigation = useNavigation()
  const pendingPathname =
    navigation.state !== "idle" ? navigation.location?.pathname : undefined
  const pendingPath = pendingPathname?.startsWith("/example/")
    ? "/example"
    : pendingPathname
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  useRouteScrollRestoration(scrollViewportRef, pagePathname)
  const headerBlurRef = useRef<HTMLDivElement>(null)
  const bottomBlurRef = useRef<HTMLDivElement>(null)
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false)
  const [hasVerticalOverflow, setHasVerticalOverflow] = useState(false)
  const user = rootData?.user ?? null
  const isOverviewRoute = matches.some((match) => match.id === "routes/overview")
  const pageHeaderData: PageHeaderData | undefined = isOverviewRoute ? {
    title: overviewGreeting,
    description: t("dashboard:description"),
  } : undefined
  const isNotesRoute = Boolean(notesMatch)
  const isTableRoute =
    isNotesRoute ||
    matches.some((match) => match.id === "routes/team")
  useBottomScrollFade(scrollViewportRef, bottomBlurRef, isTableRoute)
  function openCreateNote() {
    navigate("/example/new")
  }
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

    const updateScrollFades = () => {
      const headerBlur = headerBlurRef.current

      setHasHorizontalOverflow(viewport.scrollWidth > viewport.clientWidth + 1)
      setHasVerticalOverflow(viewport.scrollHeight > viewport.clientHeight + 1)

      if (headerBlur) {
        headerBlur.style.opacity = String(
          Math.min(1, Math.max(0, viewport.scrollTop / 48)),
        )
      }
    }
    const resizeObserver = new ResizeObserver(updateScrollFades)
    const content = viewport.querySelector('[data-slot="scroll-area-content"]')

    resizeObserver.observe(viewport)
    if (content) {
      resizeObserver.observe(content)

      for (const child of content.children) {
        resizeObserver.observe(child)
      }
    }

    viewport.addEventListener("scroll", updateScrollFades, { passive: true })
    updateScrollFades()

    return () => {
      resizeObserver.disconnect()
      viewport.removeEventListener("scroll", updateScrollFades)
    }
  }, [pageHeaderData?.title])

  if (import.meta.env.VITE_APP_LAYOUT_STYLE === "floating") {
    return (
      <FloatingLayout
        animatePage={animatePage}
        billingNotification={rootData?.billingNotification}
        isDesktop={isDesktop}
        isElectron={isElectron}
        isTableRoute={isTableRoute}
        fillContent={isOverviewRoute}
        pendingPath={pendingPath}
        menuItems={menuItems}
        pageHeaderData={pageHeaderData}
        routePathname={pagePathname}
        user={user}
      />
    )
  }

  return (
    <main
      className={cn(
        "classic-layout relative flex h-dvh flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        isElectron && "pt-8",
      )}
      data-electron={isElectron}
    >
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
            className="electron-no-drag flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            draggable={false}
            prefetch="none"
            to={href("/")}
          >
            <AppLogo aria-hidden="true" className="size-6" />
          </Link>

          <nav className="flex w-full flex-col gap-2">
            <TooltipProvider delay={0}>
              {menuItems.map((item) => (
                <Tooltip key={item.path}>
                  <TooltipTrigger
                    delay={0}
                    render={
                      <NavLink
                        aria-label={t(item.labelKey)}
                        className={({ isActive }) =>
                          cn(
                            "relative flex aspect-square items-center justify-center rounded-md text-sm transition-[background-color,color] duration-300 ease-out before:absolute before:-left-3 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-sm before:bg-primary before:content-[''] before:transition-[opacity,scale] before:duration-300 before:ease-out motion-reduce:transition-none motion-reduce:before:transition-none",
                            (pendingPath ? pendingPath === item.path : isActive)
                              ? "bg-[color-mix(in_oklab,var(--sidebar-accent)_97.5%,black)] text-sidebar-accent-foreground before:scale-y-100 before:opacity-100"
                              : "text-muted-foreground before:scale-y-50 before:opacity-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          )
                        }
                        draggable={false}
                        end={item.path === "/"}
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

          <div className="flex flex-col items-center gap-2">
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
            scrollFade={true}
            scrollbarClassName={cn(
              (isTableRoute || !hasVerticalOverflow) && "[&[data-orientation=vertical]]:hidden",
              !hasHorizontalOverflow && "[&[data-orientation=horizontal]]:hidden",
            )}
            viewportProps={{
              className: cn("app-page-scroll !overflow-x-hidden", isTableRoute && "md:!overflow-y-hidden"),
              ref: scrollViewportRef,
            }}
          >
            <div className="flex min-h-full min-w-0 flex-col md:h-full">
              {pageHeaderData?.title && !isTableRoute ? (
                <div
                  className="sticky top-0 z-10 hidden shrink-0 px-6 pt-6 pb-6 md:block"
                  key={`header-${pagePathname}`}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-0 bg-background/25 backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)] will-change-opacity md:bg-background/40 md:backdrop-blur-[40px] md:mask-[linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)]"
                    ref={headerBlurRef}
                    style={{ opacity: 0 }}
                  />
                  <PageHeader
                    actions={
                      isNotesRoute && pageHeaderData.actionLabel ? (
                        <Button
                          onClick={openCreateNote}
                          size="lg"
                          type="button"
                        >
                          <Icon aria-hidden="true" name="add" size={16} />
                          {pageHeaderData.actionLabel}
                        </Button>
                      ) : pageHeaderData.actionHref &&
                        pageHeaderData.actionLabel ? (
                        <Button
                          render={<Link to={pageHeaderData.actionHref} />}
                          size="lg"
                        >
                          <Icon aria-hidden="true" name="add" size={16} />
                          {pageHeaderData.actionLabel}
                        </Button>
                      ) : undefined
                    }
                    className={cn("relative z-10", animatePage && "route-enter")}
                    description={pageHeaderData.description}
                    refreshing={pageHeaderData.refreshing ?? false}
                    title={pageHeaderData.title}
                  />
                </div>
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-6 p-6 md:min-h-0 md:pt-0 md:px-6">
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

                  <div className="flex items-center gap-2">
                    <SettingsModal hashOwner={!isDesktop} />
                    <Profile user={user} />
                  </div>
                </header>

                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col md:min-h-0",
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
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 md:h-8 bg-background/75 backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_top,black_0%,black_45%,transparent_100%)] will-change-opacity max-md:!opacity-100",
              isTableRoute && "md:hidden",
            )}
            ref={bottomBlurRef}
          />
        </section>
      </div>

      <nav className="flex h-13 shrink-0 items-center justify-center gap-5 border-t border-border bg-background p-5 md:hidden">
        {menuItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-300 ease-out [-webkit-touch-callout:none] motion-reduce:transition-none",
                (pendingPath ? pendingPath === item.path : isActive)
                  ? "border-border bg-sidebar-accent text-sidebar-accent-foreground shadow-xs"
                  : "border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )
            }
            draggable={false}
            end={item.path === "/"}
            key={item.path}
            onContextMenu={(event) => event.preventDefault()}
            defaultShouldRevalidate={false}
            prefetch={navigationPrefetch}
            to={href(item.path)}
          >
            {({ isActive }) => (
              <>
                <NavigationIcon
                  active={pendingPath ? pendingPath === item.path : isActive}
                  activeIcon={item.activeIcon}
                  icon={item.icon}
                  size={16}
                />
                <span>{t(item.labelKey)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </main>
  )
}
