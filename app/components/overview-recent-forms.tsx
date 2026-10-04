import type { inferRouterOutputs } from "@trpc/server"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import type { AppRouter } from "~/.server/main"
import Icon from "~/components/icons"
import { OverviewTable, type OverviewTableVariant } from "~/components/overview-table"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { formatDateTime, formatNumber } from "~/lib/format-preference"
import type { FormatPreference } from "~/lib/format-preference"

type OverviewRecentFormsProps = {
  forms: inferRouterOutputs<AppRouter>["forms"]["overview"]["recentForms"]
  formatPreference: FormatPreference
  timeZone: string
  variant?: OverviewTableVariant
}

export function OverviewRecentForms({ forms, formatPreference, timeZone, variant = "padded" }: OverviewRecentFormsProps) {
  const { t, i18n } = useTranslation(["dashboard", "forms"])
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"

  return (
    <OverviewTable
      icon="forms"
      iconTone="green"
      title={t("recentForms.title")}
      variant={variant}
      emptyStateClassName="max-sm:min-h-112"
      emptyState={forms.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Icon aria-hidden={true} name="forms" /></EmptyMedia>
            <EmptyTitle>{t("forms:empty.title")}</EmptyTitle>
            <EmptyDescription>{t("forms:empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : undefined}
      action={(
        <Button render={<Link to="/forms" />} size="sm" variant="ghost">
          {t("recentForms.viewAll")}
          <Icon aria-hidden={true} name="arrowRight" size={16} />
        </Button>
      )}
    >
      <TableHeader>
        <TableRow>
          <TableHead scope="col">{t("recentForms.form")}</TableHead>
          <TableHead className="hidden w-28 sm:table-cell" scope="col">{t("recentForms.status")}</TableHead>
          <TableHead className="w-28 text-right in-data-[overview-variant=padded]:max-sm:rounded-r-lg in-data-[overview-variant=full-width]:max-sm:pr-5" scope="col">{t("recentForms.responses")}</TableHead>
          <TableHead className="hidden w-32 text-right sm:table-cell" scope="col">{t("recentForms.updated")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {forms.map((form) => {
          const title = form.title.replace(/^Untitled(?=_\d+$|$)/, t("forms:untitled"))
          const status = form.status === "PUBLISHED" && !form.enabled ? "CLOSED" : form.status
          const statusBadge = (
            <Badge variant={status === "PUBLISHED" ? "success" : "secondary"}>
              {t(`forms:status.${status.toLowerCase()}`)}
            </Badge>
          )

          return (
            <TableRow className="relative cursor-pointer" key={form.id}>
              <TableCell className="py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden={true} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon name="forms" size={18} stroke={1.75} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Link className="keyboard-focusable block truncate rounded-sm leading-5 font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring" to={`/forms/${form.id}/edit`}>
                      {title}
                    </Link>
                    <div className="sm:hidden">{statusBadge}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{statusBadge}</TableCell>
              <TableCell className="text-right tabular-nums in-data-[overview-variant=padded]:max-sm:rounded-r-lg in-data-[overview-variant=full-width]:max-sm:pr-5">
                {formatNumber(form._count.submissions, formatPreference)}
              </TableCell>
              <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                <time dateTime={form.updatedAt.toISOString()}>
                  {formatDateTime(form.updatedAt, { formatPreference, language, timeZone, includeTime: false, includeYear: false }).replace(/\.$/, "")}
                </time>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </OverviewTable>
  )
}
