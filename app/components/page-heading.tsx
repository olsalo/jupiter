import { createContext, useContext, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Spinner } from "~/components/ui/spinner"
import { Separator } from "~/components/ui/separator"
import { BillingNotificationBar } from "~/components/billing-notification-bar"
import type { BillingNotification } from "~/lib/billing"
import { cn } from "~/lib/utils"

export const PageBillingNotificationContext = createContext<BillingNotification | null | undefined>(null)

export type PageHeadingProps = {
  actions?: ReactNode
  controls?: ReactNode
  mobileControls?: ReactNode
  className?: string
  description?: ReactNode
  refreshing?: boolean
  showDescriptionOnMobile?: boolean
  showBillingNotification?: boolean
  title: ReactNode
}

export function PageHeading({
  actions,
  controls,
  mobileControls,
  className,
  description,
  refreshing = false,
  showDescriptionOnMobile = false,
  showBillingNotification = false,
  title,
}: PageHeadingProps) {
  const { t } = useTranslation()
  const billingNotification = useContext(PageBillingNotificationContext)
  const showRefreshSpinner = refreshing

  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
        (controls || mobileControls) && "max-md:flex-wrap",
        showBillingNotification && billingNotification && "md:gap-y-6",
      )}
    >
      {showBillingNotification && billingNotification ? (
        <div className="hidden w-full md:block">
          <BillingNotificationBar notification={billingNotification} variant="inline" />
        </div>
      ) : null}
      <div className={cn("min-w-0", (controls || mobileControls) && "flex-1")}>
        <h1 className={cn("relative w-fit min-w-0 max-w-full text-xl font-medium", showRefreshSpinner && "pe-7")}>
          {title}
          {showRefreshSpinner ? (
            <Spinner aria-label={t("refreshing")} className="absolute end-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          ) : null}
        </h1>
        {description ? (
          <span
            className={cn(
              "mt-1 block max-w-2xl text-xs leading-4 text-muted-foreground",
              !showDescriptionOnMobile && "max-md:hidden",
            )}
          >
            {description}
          </span>
        ) : null}
      </div>
      {controls ? <div className="order-3 flex w-full min-w-0 items-center gap-2 md:order-2 md:w-auto">{controls}</div> : null}
      {mobileControls ? <div className="order-3 flex w-full min-w-0 items-center gap-2 md:hidden">{mobileControls}</div> : null}
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2",
            (controls || mobileControls) && "order-2 md:order-3 md:gap-4",
            import.meta.env.VITE_APP_LAYOUT_STYLE !== "floating" && "[&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:before:rounded-[calc(var(--radius-lg)-1px)]",
          )}
        >
          {controls ? <Separator className="hidden h-9 self-center md:block" orientation="vertical" /> : null}
          {actions}
        </div>
      ) : null}
    </header>
  )
}
