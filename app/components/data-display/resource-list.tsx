import type { ReactNode } from "react"

import Icon, { type AppIconName } from "~/components/icons"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty"
import { Spinner } from "~/components/ui/spinner"
import { cn } from "~/lib/utils"

export type ResourceListItem = {
  action?: ReactNode
  id: string
  title: ReactNode
  icon: AppIconName
  meta?: ReactNode
}

type ResourceListProps = {
  items: ResourceListItem[]
  loading?: boolean
  loadingVariant?: "spinner" | "skeleton"
  skeletonRowCount?: number
  skeletonHasAction?: boolean
  onSelect?: (item: ResourceListItem) => void
  emptyTitle: ReactNode
  emptyDescription: ReactNode
  emptyIcon?: AppIconName
  loadingLabel: string
}

export function ResourceList({
  items,
  loading = false,
  loadingVariant,
  skeletonRowCount,
  skeletonHasAction = false,
  onSelect,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  loadingLabel,
}: ResourceListProps) {
  const showSkeleton = loading && loadingVariant !== "spinner" &&
    skeletonRowCount !== undefined && Number.isFinite(skeletonRowCount) && skeletonRowCount > 0

  if (loading) {
    if (!showSkeleton) {
      return (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Spinner aria-label={loadingLabel} className="size-6 text-muted-foreground" />
        </div>
      )
    }

    return (
      <div aria-label={loadingLabel} className="flex w-full flex-col gap-4" role="status">
        {Array.from({ length: Math.max(1, Math.floor(skeletonRowCount ?? 0)) }, (_, index) => (
          <div
            aria-hidden={true}
            className="w-full rounded-md border border-border/70 bg-card shadow-xs/5"
            key={index}
          >
            <div className={cn(
              "grid w-full content-start items-stretch gap-4 rounded-md px-3 py-3 sm:px-4 sm:py-3.5",
              skeletonHasAction
                ? onSelect
                  ? "grid-cols-[auto_minmax(0,1fr)_2.25rem_auto] sm:grid-cols-[auto_minmax(0,1fr)_2rem_auto]"
                  : "grid-cols-[auto_minmax(0,1fr)_2.25rem] sm:grid-cols-[auto_minmax(0,1fr)_2rem]"
                : onSelect
                  ? "grid-cols-[auto_minmax(0,1fr)_auto]"
                  : "grid-cols-[auto_minmax(0,1fr)]",
            )}>
              <Skeleton className="h-full w-auto aspect-square rounded-md" />
              <div className="min-w-0">
                <div className="flex h-6 items-center">
                  <Skeleton className={cn("h-4", index % 2 === 0 ? "w-2/5" : "w-3/5")} />
                </div>
                <div className="mt-2 flex h-5.5 items-center gap-3 sm:h-4.5">
                  <Skeleton className="h-5.5 w-16 rounded-sm sm:h-4.5" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="hidden h-3 w-24 sm:block" />
                </div>
              </div>
              {skeletonHasAction ? (
                <div className="flex items-center justify-center">
                  <Skeleton className="size-9 rounded-lg sm:size-8" />
                </div>
              ) : null}
              {onSelect ? (
                <Icon aria-hidden={true} className="shrink-0 self-center text-muted-foreground" name="chevronRight" size={18} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <Empty className="min-h-0 w-full border-0 bg-transparent">
        <EmptyHeader>
          {emptyIcon ? (
            <EmptyMedia variant="icon">
              <Icon aria-hidden={true} name={emptyIcon} size={18} />
            </EmptyMedia>
          ) : null}
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {items.map((item) => {
        const content = (
          <>
            <span className="flex h-full w-auto aspect-square shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/36 text-muted-foreground transition-colors group-hover:bg-muted/60 group-active:bg-muted/60">
              <Icon aria-hidden={true} name={item.icon} size={22} />
            </span>
            <span className="min-w-0 w-full">
              <span
                className="block max-w-full truncate font-medium"
                title={typeof item.title === "string" ? item.title : undefined}
              >
                {item.title}
              </span>
              {item.meta ? <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">{item.meta}</span> : null}
            </span>
            {item.action ? <span aria-hidden={true} className="size-9 sm:size-8" /> : null}
            {onSelect ? (
              <Icon
                aria-hidden={true}
                className="shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-active:translate-x-0.5"
                name="chevronRight"
                size={18}
              />
            ) : null}
          </>
        )
        const rowClassName = cn(
          "group grid w-full content-start items-stretch gap-4 rounded-md px-3 py-3 text-left sm:px-4 sm:py-3.5",
          item.action
            ? onSelect
              ? "grid-cols-[auto_minmax(0,1fr)_2.25rem_auto] sm:grid-cols-[auto_minmax(0,1fr)_2rem_auto]"
              : "grid-cols-[auto_minmax(0,1fr)_2.25rem] sm:grid-cols-[auto_minmax(0,1fr)_2rem]"
            : onSelect
              ? "grid-cols-[auto_minmax(0,1fr)_auto]"
              : "grid-cols-[auto_minmax(0,1fr)]",
          onSelect && "transition-colors hover:bg-muted/48 active:bg-muted/48 focus-visible:bg-muted/48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          !onSelect && "transition-colors hover:bg-muted/30 active:bg-muted/50",
        )

        return (
          <div
            className="relative w-full rounded-md border border-border/70 bg-card shadow-xs/5"
            key={item.id}
          >
            {onSelect ? (
              <button className={rowClassName} onClick={() => onSelect(item)} type="button">
                {content}
              </button>
            ) : (
              <div className={rowClassName}>{content}</div>
            )}
            {item.action ? (
              <div className={cn(
                "absolute inset-y-0 z-1 flex items-center",
                onSelect ? "right-12 sm:right-14" : "right-3 sm:right-4",
              )}>
                {item.action}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
