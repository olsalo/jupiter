import type { ReactNode } from "react"

import { cn } from "~/lib/utils"

export type PageLayoutProps = {
  children: ReactNode
  header: ReactNode
  className?: string
  contentClassName?: string
}

export function ViewportPage(props: PageLayoutProps) {
  return <PageFrame {...props} contained={true} />
}

export function ScrollPage(props: PageLayoutProps) {
  return <PageFrame {...props} contained={false} />
}

function PageFrame({ children, header, className, contentClassName, contained }: PageLayoutProps & { contained: boolean }) {
  const isFloatingLayout = import.meta.env.VITE_APP_LAYOUT_STYLE === "floating"
  const centerContent = import.meta.env.VITE_APP_CENTER_CONTENT === "true"

  return <section
    className={cn(
      "flex min-w-0 w-full flex-1 flex-col",
      contained ? "h-full min-h-0 overflow-hidden" : "min-h-full",
      isFloatingLayout && "md:grid md:grid-cols-1",
      isFloatingLayout && (centerContent && !contained
        ? "md:grid-rows-[minmax(6rem,1fr)_auto_minmax(0.75rem,1fr)]"
        : contained
          ? "md:grid-rows-[6rem_minmax(0,1fr)]"
          : "md:grid-rows-[6rem_auto]"),
      className,
    )}
    data-slot={contained ? "viewport-page" : "scroll-page"}
  >
    <div className={cn("flex min-w-0 flex-1 flex-col md:row-start-2", contained && "min-h-0")}>
      {header}
      <div
        className={cn(
          "relative isolate z-0 flex min-w-0 flex-1 flex-col gap-4",
          contained && "h-0 min-h-0 overflow-hidden",
          contentClassName,
        )}
        data-slot="page-content"
      >
        {children}
      </div>
    </div>
  </section>
}
