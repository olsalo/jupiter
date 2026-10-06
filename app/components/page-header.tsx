import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

type PageHeaderProps = {
  actions?: ReactNode
  className?: string
  description?: ReactNode
  refreshing?: boolean
  showDescriptionOnMobile?: boolean
  title: ReactNode
}

export function PageHeader({
  actions,
  className,
  description,
  refreshing = false,
  showDescriptionOnMobile = false,
  title,
}: PageHeaderProps) {
  const { t } = useTranslation()
  const showRefreshSpinner = refreshing

  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className={cn("relative w-fit min-w-0 max-w-full text-xl font-medium", showRefreshSpinner && "pe-7")}>
          {title}
          {showRefreshSpinner ? (
            <Spinner aria-label={t("refreshing")} className="absolute end-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          ) : null}
        </h1>
        {description ? (
          <span
            className={cn(
              "max-w-2xl text-xs text-muted-foreground",
              !showDescriptionOnMobile && "max-md:hidden",
            )}
          >
            {description}
          </span>
        ) : null}
      </div>
      {actions ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2",
            import.meta.env.VITE_APP_LAYOUT_STYLE !== "floating" && "[&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:before:rounded-[calc(var(--radius-lg)-1px)]",
          )}
        >
          {actions}
        </div>
      ) : null}
    </header>
  )
}
