import { useRef, type ComponentProps } from "react"
import { useTranslation } from "react-i18next"
import { Link, NavLink, Outlet, href, useNavigate } from "react-router"

import { AppLogo } from "~/components/app-logo"
import { BillingNotificationBar } from "~/components/billing-notification-bar"
import Icon, { type AppIconName } from "~/components/icons"
import { NavigationIcon } from "~/components/navigation-icon"
import { PageBillingNotificationContext, PageHeader } from "~/components/page-header"
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
import { useBottomScrollFade } from "~/lib/use-bottom-scroll-fade"
import { useRouteScrollRestoration } from "~/lib/use-route-scroll-restoration"

type NavigationItem = {
  activeIcon?: AppIconName
  icon: AppIconName
  labelKey: "nav.overview" | "nav.notes" | "nav.team"
  path: "/" | "/example" | "/team"
}

type FloatingLayoutProps = {
  animatePage: boolean
  billingNotification: ComponentProps<
    typeof BillingNotificationBar
  >["notification"]
  isDesktop: boolean
  isElectron: boolean
  isTableRoute: boolean
  fillContent: boolean
  menuItems: readonly NavigationItem[]
  pendingPath?: string
  pageHeaderData?: {
    actionHref?: string
    actionLabel?: string
    description?: string
    refreshing?: boolean
    title?: string
  }
  routePathname: string
  user: ComponentProps<typeof Profile>["user"]
}

const floatingPopupGap = 8

export function FloatingLayout({
  animatePage,
  billingNotification,
  isDesktop,
  isElectron,
  isTableRoute,
  fillContent,
  menuItems,
  pendingPath,
  pageHeaderData,
  routePathname,
  user,
}: FloatingLayoutProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const centerContent = import.meta.env.VITE_APP_CENTER_CONTENT === "true"
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  useRouteScrollRestoration(scrollViewportRef, routePathname)
  const bottomFadeRef = useRef<HTMLDivElement>(null)
  useBottomScrollFade(scrollViewportRef, bottomFadeRef, isTableRoute)
  const navigationPrefetch = isDesktop ? "intent" : "viewport"

  return (
    <PageBillingNotificationContext.Provider value={isDesktop ? billingNotification : null}>
      <main
        className={cn(
          "floating-layout relative h-dvh w-full overflow-x-clip bg-background text-foreground",
          isElectron && "[--page-header-top-padding:2.5rem]",
          !isTableRoute && "[&_.route-mobile-header]:hidden",
        )}
        data-electron={isElectron}
      >
        <ScrollArea
          className={cn(
            "h-full w-full",
            isTableRoute && "max-md:[&_[data-slot=scroll-area-content]]:h-auto",
          )}
          fill={isTableRoute}
          scrollbarClassName={cn(
            "z-20 max-md:hidden [&[data-orientation=horizontal]]:hidden",
            isTableRoute && "md:[&[data-orientation=vertical]]:hidden",
          )}
          viewportProps={{
            className: cn("app-page-scroll !overflow-x-hidden", isTableRoute && "md:!overflow-y-hidden"),
            ref: scrollViewportRef,
          }}
        >
          <div
            className={cn(
              "flex min-h-dvh flex-col",
              isTableRoute && "md:h-full md:min-h-0",
              isElectron && "pt-7",
            )}
          >
            {!isDesktop ? <BillingNotificationBar notification={billingNotification} /> : null}

            <div
              className={cn(
                "mx-auto flex w-[calc(100%-44px)] max-w-4xl flex-1 flex-col pb-[calc(70px+max(20px,env(safe-area-inset-bottom)))] md:w-[calc(100%-160px)] md:pb-4",
                isTableRoute
                  ? "md:min-h-0 md:pt-0 md:[--table-page-header-gap:0.75rem] [&_.table-page-header]:pt-[var(--page-header-top-padding,0.875rem)] [&_.table-page-header]:pb-3 [&_.table-page-header_h1]:text-2xl [&_.table-page-header_h1]:font-semibold [&_.table-page-header_h1]:tracking-normal [&_.table-page-header_span]:leading-4"
                  : "md:pt-0",
                "md:[--table-page-top-space:6rem]",
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

              {!isTableRoute ? (
                <div aria-hidden="true" className={cn("hidden md:block", centerContent && !fillContent ? "md:min-h-24 md:flex-1" : "md:h-24 md:shrink-0")} />
              ) : null}

              {pageHeaderData?.title && !isTableRoute ? (
                <div
                  className="sticky top-0 z-10 mt-8 shrink-0 md:mt-0 md:mb-3"
                  key={`header-${routePathname}`}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 bottom-0 md:-bottom-3 left-1/2 w-screen -translate-x-1/2 bg-background/25 backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)] md:bg-background/40 md:backdrop-blur-[40px] md:mask-[linear-gradient(to_bottom,black_0%,black_75%,transparent_100%)]"
                  />
                  <PageHeader
                    showBillingNotification={true}
                    actions={
                      pageHeaderData.actionLabel &&
                      pageHeaderData.actionHref ? (
                        <Button
                          aria-label={pageHeaderData.actionLabel}
                          className="electron-no-drag h-9 rounded-xl max-md:w-9 max-md:px-0"
                          render={<Link to={pageHeaderData.actionHref} />}
                          size="lg"
                        >
                          <Icon aria-hidden="true" name="add" size={20} />
                          <span className="max-md:sr-only">
                            {pageHeaderData.actionLabel}
                          </span>
                        </Button>
                      ) : undefined
                    }
                    className={cn(
                      "relative items-start gap-2 pt-[var(--page-header-top-padding,0.875rem)] pb-3 max-md:flex-nowrap max-md:items-center max-md:gap-2 max-md:[&_h1]:truncate [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-normal [&_span]:leading-4",
                      animatePage && "route-enter",
                    )}
                    description={pageHeaderData.description}
                    refreshing={pageHeaderData.refreshing ?? false}
                    showDescriptionOnMobile={false}
                    title={pageHeaderData.title}
                  />
                </div>
              ) : null}

              <section
                className={cn(
                  "mt-3 flex min-w-0 flex-1 flex-col md:mt-0",
                  isTableRoute
                    ? "max-md:mt-0 md:min-h-0"
                    : fillContent
                      ? "md:min-h-0"
                      : "md:flex-none",
                  animatePage && "route-enter",
                )}
                key={`content-${routePathname}`}
              >
                <Outlet />
              </section>

              {!isTableRoute && !fillContent ? (
                <div aria-hidden="true" className="hidden md:block md:min-h-3 md:flex-1" />
              ) : null}
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
            "pointer-events-none fixed inset-x-0 bottom-0 z-10 h-[calc(112px+env(safe-area-inset-bottom))] bg-background/75 backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_top,black_0%,black_45%,transparent_100%)] will-change-opacity max-md:!opacity-100 md:h-8",
            isTableRoute && "md:hidden",
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

        <TooltipProvider delay={0}>
          <nav
            aria-label={t("appName")}
            className="electron-no-drag fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background p-1 shadow-[0_0_4px_rgba(0,0,0,0.1)] md:top-1/2 md:bottom-auto md:left-3.5 md:-translate-x-0 md:-translate-y-1/2 md:flex-col"
          >
            {menuItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger
                  render={
                    <NavLink
                      aria-label={t(item.labelKey)}
                      className={({ isActive }) =>
                        cn(
                          "flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring max-md:[-webkit-touch-callout:none] md:size-9",
                          (pendingPath ? pendingPath === item.path : isActive)
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                      draggable={false}
                      onTouchStart={() => navigate(href(item.path))}
                      end={item.path === "/"}
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
