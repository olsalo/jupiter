import type { ComponentProps, ReactNode } from "react"

import { PageHeader } from "~/components/page-header"
import { ScrollArea } from "~/components/ui/scroll-area"
import { cn } from "~/lib/utils"

type PageLayoutProps = Pick<ComponentProps<typeof PageHeader>, "actions" | "description" | "title"> & {
  children: ReactNode
}

export function PageLayout({ actions, children, description, title }: PageLayoutProps) {
  const centerContent = import.meta.env.VITE_APP_CENTER_CONTENT === "true"

  return (
    <ScrollArea
      className="h-0 min-h-0 flex-1 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:h-auto [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col"
      fill={true}
      scrollbarClassName="z-20 data-[orientation=horizontal]:hidden"
      viewportProps={{ className: "!overflow-x-hidden" }}
    >
      <div className="flex w-full min-w-0 flex-1 flex-col pb-6">
        <div
          aria-hidden="true"
          className={cn("hidden md:block", centerContent ? "md:min-h-24 md:flex-1" : "md:h-24 md:shrink-0")}
        />

        <div className="sticky top-0 z-10 mt-6 shrink-0 md:mt-0 md:mb-3">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -bottom-3 bg-background/75 backdrop-blur-[28px] backdrop-saturate-150 mask-[linear-gradient(to_bottom,black_0%,black_45%,transparent_100%)] md:bg-background/95 md:backdrop-blur-[40px] md:mask-[linear-gradient(to_bottom,black_0%,black_60%,transparent_100%)]"
          />
          <PageHeader
            actions={actions}
            className="relative mx-auto w-full max-w-180 items-start gap-2 px-6 pt-3 pb-3 max-md:flex-nowrap max-md:items-center max-md:[&_h1]:truncate [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-normal [&_span]:leading-4"
            description={description}
            showDescriptionOnMobile={false}
            title={title}
          />
        </div>

        <section className="mx-auto mt-3 flex w-full min-w-0 max-w-180 shrink-0 flex-col px-6 md:mt-0">
          {children}
        </section>

        <div aria-hidden="true" className="hidden md:block md:min-h-3 md:flex-1" />
      </div>
    </ScrollArea>
  )
}
