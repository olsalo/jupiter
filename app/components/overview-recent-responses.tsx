import type { inferRouterOutputs } from "@trpc/server"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import type { AppRouter } from "~/.server/main"
import Icon from "~/components/icons"
import { OverviewTable, type OverviewTableVariant } from "~/components/overview-table"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { formatDateTime } from "~/lib/format-preference"
import type { FormatPreference } from "~/lib/format-preference"

type OverviewRecentResponsesProps = {
  responses: inferRouterOutputs<AppRouter>["forms"]["overview"]["recentResponses"]
  formatPreference: FormatPreference
  timeZone: string
  variant?: OverviewTableVariant
}

export function OverviewRecentResponses({ responses, formatPreference, timeZone, variant = "padded" }: OverviewRecentResponsesProps) {
  const { t, i18n } = useTranslation(["dashboard", "forms"])
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const dateOptions = { formatPreference, language, timeZone } as const

  return (
    <OverviewTable
      icon="mail"
      iconTone="blue"
      title={t("recentResponses.title")}
      variant={variant}
      emptyStateClassName="max-sm:min-h-104.5"
      emptyState={responses.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Icon aria-hidden={true} name="user" /></EmptyMedia>
            <EmptyTitle>{t("forms:responseView.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("recentResponses.emptyDescription")}</EmptyDescription>
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
          <TableHead scope="col">{t("forms:responseView.responder")}</TableHead>
          <TableHead className="hidden w-48 sm:table-cell" scope="col">{t("recentForms.form")}</TableHead>
          <TableHead className="w-40 text-right sm:w-48" scope="col">{t("forms:responseView.submittedAt")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {responses.map((response) => {
          const title = response.form.title.replace(/^Untitled(?=_\d+$|$)/, t("forms:untitled"))
          const responder = response.respondentEmail ?? t("forms:responseView.anonymous")

          return (
            <TableRow className="relative cursor-pointer" key={response.id}>
              <TableCell className="py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden={true} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon name="user" size={18} stroke={1.75} /></span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Link
                      className="keyboard-focusable block truncate rounded-sm leading-5 font-medium after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
                      to={`/forms/${response.formId}/responses/${encodeURIComponent(response.id)}`}
                    >
                      {responder}
                    </Link>
                    <span className="truncate text-xs leading-4 text-muted-foreground sm:hidden">{title}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell"><span className="block truncate leading-5 text-muted-foreground">{title}</span></TableCell>
              <TableCell className="text-right text-muted-foreground">
                <time className="inline-flex items-center gap-2 text-xs leading-5 tabular-nums sm:gap-2.5 sm:text-sm" aria-label={formatDateTime(response.submittedAt, dateOptions)} dateTime={response.submittedAt.toISOString()} title={formatDateTime(response.submittedAt, dateOptions)}>
                  <span className="text-muted-foreground">{formatDateTime(response.submittedAt, { ...dateOptions, includeTime: false, includeYear: false }).replace(/\.$/, "")}</span>
                  <span aria-hidden={true} className="h-3 w-px shrink-0 bg-border" />
                  <span className="text-xs text-muted-foreground/75">{formatDateTime(response.submittedAt, { ...dateOptions, includeDate: false })}</span>
                </time>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </OverviewTable>
  )
}
