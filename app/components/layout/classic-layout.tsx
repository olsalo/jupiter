import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, Outlet, href } from "react-router"

import { AppLogo } from "~/components/navigation/app-logo"
import { BillingNotificationBar } from "~/components/billing/billing-notification-bar"
import { NavigationIcon } from "~/components/navigation/navigation-icon"
import { PageBottomFade } from "~/components/layout/page-bottom-fade"
import { Profile } from "~/components/navigation/profile"
import { SettingsModal } from "~/components/settings/settings-modal"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import type { WorkspaceLayoutProps } from "~/components/layout/workspace-layout"
import { useMobileMenuNavigation } from "~/lib/routing/mobile-navigation"
import { useRouteScrollRestoration } from "~/lib/hooks/use-route-scroll-restoration"
import { cn } from "~/lib/utils"

type ClassicLayoutProps = WorkspaceLayoutProps & {
  isMobile: boolean
}

export function ClassicLayout({
  animatePage,
  billingNotification,
  isDesktop,
  isElectron,
  isMobile,
  isViewportPage,
  menuItems,
  pageLayout,
  pendingPath,
  routePathname: pagePathname,
  user,
}: ClassicLayoutProps) {
  const { t } = useTranslation()
  const mobileMenuNavigation = useMobileMenuNavigation()
  const navigationPrefetch = isDesktop ? "intent" : "viewport"
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  useRouteScrollRestoration(scrollViewportRef, pagePathname)

  return (
    <main
      className={cn(
        "classic-layout pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] relative flex h-dvh flex-col overflow-hidden bg-background text-sidebar-foreground md:bg-sidebar",
        isElectron && "pt-8",
      )}
      data-electron={isElectron}
      data-page-layout={pageLayout}
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
                              ? "bg-[color-mix(in_oklab,var(--sidebar-accent)_97.5%,black)] text-primary before:scale-y-100 before:opacity-100"
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
            <SettingsModal hashOwner={isDesktop} showTooltip={true} />
            <Profile user={user} />
          </div>
        </aside>

        <section className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground md:rounded-md md:border md:border-border md:shadow-xs">
          <BillingNotificationBar
            notification={billingNotification}
          />
          <ScrollArea
            className="min-h-0 flex-1"
            fill={true}
            scrollFade={false}
            scrollbarClassName={cn(
              "z-20 max-md:hidden [&[data-orientation=horizontal]]:hidden",
              isViewportPage && "[&[data-orientation=vertical]]:hidden",
            )}
            viewportProps={{
              className: cn("app-page-scroll !overflow-x-hidden", pageLayout === "viewport-desktop" && isMobile && "[overflow-anchor:none]", isViewportPage && "!overflow-y-hidden"),
              ref: scrollViewportRef,
            }}
          >
            <div className={cn("flex min-h-full min-w-0 flex-col", isViewportPage && "h-full min-h-0")}>
              <div className={cn("flex min-w-0 flex-1 flex-col gap-0 p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] md:min-h-0 md:pt-[env(safe-area-inset-top,0px)] md:px-6", isViewportPage && "min-h-0")}>
                <header className="mb-[calc(1.5rem*(1-sign(env(safe-area-inset-top,0px))))] flex shrink-0 items-start justify-between md:hidden">
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
          <PageBottomFade variant="classic" />
        </section>
      </div>

      <nav className="grid h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 auto-cols-fr grid-flow-col place-items-center overflow-hidden border-t border-border bg-background px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 md:hidden">
        {menuItems.map((item) => (
          <NavLink
            {...mobileMenuNavigation}
            aria-label={t(item.labelKey)}
            className={({ isActive }) =>
              cn(
                "flex aspect-square w-full max-w-12 items-center justify-center rounded-lg border transition-[background-color,color,border-color,box-shadow] duration-300 ease-out [-webkit-touch-callout:none] motion-reduce:transition-none",
                (pendingPath ? pendingPath === item.path : isActive)
                  ? "border-border bg-sidebar-accent text-primary shadow-xs"
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
  )
}
