import type { ComponentProps, ReactNode } from "react"
import { cn } from "@coss/ui/lib/utils"

import type { AppIconName } from "~/components/icons"
import { OverviewCardIcon, type OverviewCardIconTone } from "~/components/overview-card-icon"
import { Card, CardHeader, CardPanel, CardTitle } from "~/components/ui/card"
import { Table } from "~/components/ui/table"

export type OverviewTableVariant = "full-width" | "padded"

type OverviewTableProps = Omit<ComponentProps<typeof Table>, "title"> & {
  title: string
  action?: ReactNode
  emptyState?: ReactNode
  emptyStateClassName?: string
  icon?: AppIconName
  iconTone?: OverviewCardIconTone
  variant?: OverviewTableVariant
}

export function OverviewTable({
  title,
  action,
  emptyState,
  emptyStateClassName,
  icon,
  iconTone = "blue",
  variant = "full-width",
  className,
  ...props
}: OverviewTableProps) {
  const table = (
    <Table
      aria-label={title}
      data-overview-variant={variant}
      className={cn(
        "table-fixed [&_tbody_tr:hover]:bg-transparent [&_td]:transition-colors [&_tbody_tr.cursor-pointer:hover>td]:bg-muted/40 [&_tbody_tr[data-state=selected]>td]:bg-muted/40",
        variant === "full-width"
          ? "border-t [&_thead_tr]:bg-muted/30 [&_thead_tr:hover]:bg-muted/30 [&_tr>:first-child]:px-5 [&_tr>:last-child]:px-5 sm:[&_tr>:first-child]:px-6 sm:[&_tr>:last-child]:px-6"
          : "border-separate border-spacing-x-0 border-spacing-y-1 [&_tr]:border-0 [&_tr:hover]:bg-transparent [&_th]:bg-muted/40 [&_th]:px-4 [&_td]:px-4 [&_tr>:first-child]:rounded-l-lg [&_tr>:last-child]:rounded-r-lg",
        className,
      )}
      {...props}
    />
  )

  const content = emptyState ? (
    <div aria-label={title} className={cn("flex min-h-97", emptyStateClassName)}>
      {emptyState}
    </div>
  ) : table

  return (
    <Card className="shrink-0 overflow-hidden">
      <CardHeader className={cn(
        "flex flex-row items-center justify-between gap-3",
        variant === "full-width" ? "px-5 py-4 sm:px-6" : "p-5! pb-4! sm:p-6! sm:pb-4!",
      )}>
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <OverviewCardIcon icon={icon} tone={iconTone} /> : null}
          <CardTitle className="text-base leading-6" render={<h2 />}>{title}</CardTitle>
        </div>
        {action}
      </CardHeader>
      {variant === "padded" ? (
        <CardPanel className="px-5 pb-5 sm:px-6 sm:pb-6">{content}</CardPanel>
      ) : content}
    </Card>
  )
}
