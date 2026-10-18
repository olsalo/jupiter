import type { ComponentProps, ReactNode } from "react"

import { PageHeader } from "~/components/page-header"
import { cn } from "~/lib/utils"

export function TablePage({ children, fitHeight = false }: { children: ReactNode; fitHeight?: boolean }) {
  const isFloatingLayout = import.meta.env.VITE_APP_LAYOUT_STYLE === "floating"
  const centerContent = import.meta.env.VITE_APP_CENTER_CONTENT === "true"

  return (
    <section
      className={cn(
        "flex w-full flex-1 flex-col gap-4 md:h-full md:min-h-0 md:gap-0",
        fitHeight && "h-full min-h-0",
        isFloatingLayout && "md:grid md:grid-cols-1",
        isFloatingLayout && (centerContent
          ? "md:grid-rows-[minmax(var(--table-page-top-space,6rem),1fr)_minmax(0,auto)_minmax(var(--table-page-bottom-space,0px),1fr)]"
          : "md:grid-rows-[var(--table-page-top-space,6rem)_minmax(0,auto)_minmax(var(--table-page-bottom-space,0px),1fr)]"),
      )}
    >
      <div className={cn("mx-auto flex w-full min-w-0 flex-1 flex-col md:row-start-2 md:min-h-0", fitHeight && "min-h-0")}>
        <div className={cn("flex min-w-0 flex-1 flex-col gap-4 md:min-h-0 md:gap-[var(--table-page-header-gap,1.5rem)]", fitHeight && "min-h-0")}>
          {children}
        </div>
      </div>
    </section>
  )
}

export function TablePageHeader({ className, ...props }: ComponentProps<typeof PageHeader>) {
  return (
    <PageHeader
      showBillingNotification={true}
      className={cn(
        "table-page-header route-mobile-header relative items-start gap-2 pb-3 max-md:mx-0 max-md:flex-nowrap max-md:items-center max-md:gap-2 max-md:[&_h1]:truncate md:mt-0 md:shrink-0 md:gap-2 [&_span]:leading-4",
        import.meta.env.VITE_APP_LAYOUT_STYLE === "floating"
          ? "pt-[var(--page-header-top-padding,0.875rem)] max-md:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-normal"
          : "pt-0 max-md:mt-0 md:pt-6 md:pb-0 [&_h1]:text-xl [&_h1]:font-medium",
        className,
      )}
      {...props}
    />
  )
}
