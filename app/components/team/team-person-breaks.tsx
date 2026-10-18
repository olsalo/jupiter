import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { formatDateTime } from "~/lib/format-preference"
import { useTRPC } from "~/lib/trpc/client"
import { TeamBreaksWeek } from "./team-breaks-week"
import { TeamPanelLoading } from "./team-panel-loading"
import { TeamScheduleViewHeader } from "./team-schedule-view-header"
import { useBusinessWorkingHours } from "./use-business-working-hours"
import type { TeamPerson } from "./team-types"

export function TeamPersonBreaks({ staff }: { staff: NonNullable<TeamPerson["staff"]> }) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const breaks = useQuery(trpc.availability.getBreaks.queryOptions({ staffMemberId: staff.id }))
  const hours = useQuery(trpc.availability.getRules.queryOptions({ staffMemberId: staff.id }))
  const business = useBusinessWorkingHours()
  const useDefaults = hours.isSuccess && hours.data.length === 0
  const workingHours = useDefaults ? business.hours : hours.data ?? []
  const pending = breaks.isPending || hours.isPending || (useDefaults && business.isPending)
  const failed = breaks.isError || hours.isError || (useDefaults && business.isError)
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" : "en", includeDate: false, timeZone: "UTC" })

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4">
      <TeamScheduleViewHeader title={t("people.breaks")} description={t("people.breaksDescription")} />
      {pending ? <TeamPanelLoading label={t("people.loadingBreaks")} /> : failed ? <Alert variant="error"><AlertTitle>{t("people.breaksError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={breaks.isFetching || hours.isFetching || business.isFetching} onClick={() => void Promise.all([breaks.refetch(), hours.refetch(), business.refetch()])} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : <TeamBreaksWeek rules={breaks.data ?? []} workingDays={workingHours.filter((rule) => rule.isActive).map((rule) => rule.dayOfWeek)} renderTimes={(rule) => <span className="flex h-8 items-center text-sm tabular-nums">{formatTime(rule.startMinute)} – {formatTime(rule.endMinute)}</span>} />}
    </div>
  )
}
