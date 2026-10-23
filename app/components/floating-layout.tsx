import { useRef, type ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, Outlet, href } from "react-router"

import { AppLogo } from "~/components/app-logo"
import { BillingNotificationBar } from "~/components/billing-notification-bar"
import Icon from "~/components/icons"
import { NavigationIcon } from "~/components/navigation-icon"
import { PageBillingNotificationContext } from "~/components/page-heading"
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
import type { AppNavigationItem } from "~/lib/app-navigation"
import { cn } from "~/lib/utils"
import { useMobileMenuNavigation } from "~/lib/mobile-navigation"
import { useBottomScrollFade } from "~/lib/use-bottom-scroll-fade"
import { useRouteScrollRestoration } from "~/lib/use-route-scroll-restoration"

type NavigationItem = AppNavigationItem

type FloatingLayoutProps = {
  animatePage: boolean
  billingNotification: ComponentProps<
    typeof BillingNotificationBar
  >["notification"]
  isDesktop: boolean
  isElectron: boolean
  isViewportPage: boolean
  menuItems: readonly NavigationItem[]
  pendingPath?: string
  routePathname: string
  user: ComponentProps<typeof Profile>["user"]
}

const floatingPopupGap = 8

export function FloatingLayout({
  animatePage,
  billingNotification,
  isDesktop,
  isElectron,
  isViewportPage,
  menuItems,
  pendingPath,
  routePathname,
  user,
}: FloatingLayoutProps) {
  const { t } = useTranslation()
  const mobileMenuNavigation = useMobileMenuNavigation()
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  useRouteScrollRestoration(scrollViewportRef, routePathname)
  const bottomFadeRef = useRef<HTMLDivElement>(null)
  useBottomScrollFade(scrollViewportRef, bottomFadeRef, isViewportPage)
  const navigationPrefetch = isDesktop ? "intent" : "viewport"

  return (
    <PageBillingNotificationContext.Provider value={isDesktop ? billingNotification : null}>
      <main
        className={cn(
          "floating-layout relative h-dvh w-full overflow-x-clip bg-background text-foreground",
        )}
        data-electron={isElectron}
      >
        <ScrollArea
          className="h-full w-full"
          fill={true}
          scrollbarClassName={cn(
            "z-20 max-md:hidden [&[data-orientation=horizontal]]:hidden",
            isViewportPage && "[&[data-orientation=vertical]]:hidden",
          )}
          viewportProps={{
            className: cn("app-page-scroll !overflow-x-hidden", isViewportPage && "!overflow-y-hidden"),
            ref: scrollViewportRef,
          }}
        >
          <div
            className={cn(
              "flex min-h-full flex-col",
              isViewportPage && "h-full min-h-0",
              isElectron && "pt-7",
            )}
          >
            {!isDesktop ? <BillingNotificationBar notification={billingNotification} /> : null}

            <div
              className={cn(
                "mx-auto flex w-[calc(100%-44px)] max-w-4xl flex-1 flex-col pb-[calc(70px+max(20px,env(safe-area-inset-bottom)))] md:w-[calc(100%-160px)] md:pb-4",
                isViewportPage && "min-h-0",
              )}
            >
              <div className="flex shrink-0 items-center justify-between pt-5 md:hidden">
                <Link
                  aria-label={t("nav.overviewHome")}
                  className="electron-no-drag flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
                  draggable={false}
                  prefetch="none"
                  to={href("/")}
                >
                  <AppLogo aria-hidden="true" className="size-5" />
                </Link>
                <div className="electron-no-drag flex items-center gap-3">
                  <SettingsModal hashOwner={!isDesktop} />
                  <Profile user={user} variant="light" />
                </div>
              </div>

              <section
                className={cn(
                  "flex min-w-0 flex-1 flex-col",
                  isViewportPage && "min-h-0",
                  animatePage && "route-enter",
                )}
                key={`content-${routePathname}`}
              >
                <Outlet />
              </section>
            </div>
          </div>
        </ScrollArea>

        {isElectron ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-y-0 left-0 z-10 w-[22px] md:w-[max(80px,calc((100vw-56rem)/2))]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-y-0 right-3 z-10 w-[22px] md:w-[max(68px,calc((100vw-56rem)/2-12px))]"
            />
            <div
              aria-hidden="true"
              className="electron-drag fixed top-0 left-0 right-3 z-10 h-7"
            />
          </>
        ) : null}

        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[calc(112px+env(safe-area-inset-bottom))] bg-linear-to-t from-background/75 from-50% to-transparent will-change-opacity md:h-8",
            routePathname === "/booking-page" && "md:h-14 from-background from-20%",
            isViewportPage && "hidden",
          )}
          ref={bottomFadeRef}
        />

        <Link
          aria-label={t("nav.overviewHome")}
          className={cn(
            "electron-no-drag fixed top-3.5 left-3.5 z-20 hidden size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground md:flex",
            isElectron && "top-[46px]",
          )}
          draggable={false}
          prefetch="none"
          to={href("/")}
        >
          <AppLogo aria-hidden="true" className="size-6" />
        </Link>

        <TooltipProvider>
          <nav
            aria-label={t("appName")}
            className="electron-no-drag fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background p-1 shadow-[0_0_4px_rgba(0,0,0,0.1)] md:top-1/2 md:bottom-auto md:left-3.5 md:-translate-x-0 md:-translate-y-1/2 md:flex-col max-md:max-w-[calc(100vw-2rem)] max-md:overflow-x-auto md:max-h-[calc(100dvh-12rem)] md:overflow-y-auto"
          >
            {menuItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger
                  render={
                    <NavLink
                      {...mobileMenuNavigation}
                      aria-label={t(item.labelKey)}
                      className={({ isActive }) =>
                        cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring max-md:[-webkit-touch-callout:none] md:size-9",
                          (pendingPath ? pendingPath === item.path : isActive)
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                      draggable={false}
                      end={false}
                      onContextMenu={(event) => {
                        if (window.matchMedia("(max-width: 767px)").matches) {
                          event.preventDefault()
                        }
                      }}
                      defaultShouldRevalidate={false}
                      prefetch={navigationPrefetch}
                      to={href(item.path)}
                    >
                      {({ isActive }) => (
                        <NavigationIcon
                          active={pendingPath ? pendingPath === item.path : isActive}
                          activeIcon={item.activeIcon}
                          icon={item.icon}
                          size={18}
                        />
                      )}
                    </NavLink>
                  }
                />
                <TooltipPopup
                  className="max-md:hidden"
                  side="right"
                  sideOffset={floatingPopupGap}
                >
                  {t(item.labelKey)}
                </TooltipPopup>
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>

        <div className="electron-no-drag fixed bottom-3.5 left-3.5 z-20 hidden flex-col items-center gap-1 rounded-full border border-border bg-background p-1 shadow-[0_0_4px_rgba(0,0,0,0.1)] md:flex">
          <SettingsModal
            hashOwner={isDesktop}
            showTooltip={true}
            triggerSize="icon-lg"
          />
          <Profile
            className="size-9"
            menuSide="right"
            menuSideOffset={floatingPopupGap}
            user={user}
            variant="light"
          />
        </div>
      </main>
    </PageBillingNotificationContext.Provider>
  )
}
