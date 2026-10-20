import { PageHeading, type PageHeadingProps } from "~/components/page-heading"
import { cn } from "~/lib/utils"

export function RouteHeader({ className, ...props }: PageHeadingProps) {
  const isFloatingLayout = import.meta.env.VITE_APP_LAYOUT_STYLE === "floating"

  return <PageHeading
    showBillingNotification={true}
    className={cn(
      "route-header shrink-0 items-start max-md:items-center max-md:gap-3 max-md:[&_h1]:truncate max-md:[&>div:has(h1)]:flex-1 max-md:[&>div:has(h1)]:self-center",
      isFloatingLayout && "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-normal",
      className,
    )}
    {...props}
  />
}
