import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { formatDateTime } from "~/lib/format-preference"
import { useTRPC } from "~/lib/trpc/client"
import { TeamWorkingHoursWeek } from "./team-working-hours-week"
import { TeamPanelLoading } from "./team-panel-loading"
import { TeamScheduleViewHeader } from "./team-schedule-view-header"
import { useBusinessWorkingHours } from "./use-business-working-hours"
import type { TeamPerson } from "./team-types"

export function TeamPersonAvailability({ staff }: { staff: NonNullable<TeamPerson["staff"]> }) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const rules = useQuery(trpc.availability.getRules.queryOptions({ staffMemberId: staff.id }))
  const businessHours = useBusinessWorkingHours()
  const useDefaults = rules.isSuccess && rules.data.length === 0
  const displayedRules = useDefaults ? businessHours.hours : rules.data ?? []
  const pending = rules.isPending || (useDefaults && businessHours.isPending)
  const failed = rules.isError || (useDefaults && businessHours.isError)
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), {
    formatPreference: root?.formatPreference ?? "eu",
    language: root?.locale === "fi" ? "fi" : "en",
    includeDate: false,
    timeZone: "UTC",
  })
  const options = { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" as const : "en" as const }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4">
      <TeamScheduleViewHeader title={t("people.availability")} description={t("people.hoursDescription")} />
      {pending ? <TeamPanelLoading label={t("people.loadingAvailability")} /> : failed ? (
        <Alert variant="error">
          <AlertTitle>{t("people.availabilityError")}</AlertTitle>
          <AlertDescription>{t("retryDescription")}</AlertDescription>
          <AlertAction><Button disabled={rules.isFetching || businessHours.isFetching} onClick={() => void Promise.all([rules.refetch(), businessHours.refetch()])} type="button" variant="outline" size="sm">{t("retry")}</Button></AlertAction>
        </Alert>
      ) : (
        <TeamWorkingHoursWeek<(typeof displayedRules)[number]> rules={displayedRules} renderTimes={(rule) => (
            <div className="grid gap-1">
              <span className="flex h-8 items-center text-sm tabular-nums">{formatTime(rule.startMinute)} – {formatTime(rule.endMinute)}</span>
              {rule.validFrom || rule.validUntil ? <span className="text-xs text-muted-foreground">{rule.validFrom ? t("people.hoursFrom", { date: formatDateTime(rule.validFrom, { ...options, includeTime: false, timeZone: businessHours.timezone }) }) : null}{rule.validFrom && rule.validUntil ? " · " : null}{rule.validUntil ? t("people.hoursUntil", { date: formatDateTime(rule.validUntil, { ...options, includeTime: false, timeZone: businessHours.timezone }) }) : null}</span> : null}
            </div>
        )} />
      )}
    </div>
  )
}
