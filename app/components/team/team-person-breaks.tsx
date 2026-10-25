import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { formatDateTime } from "~/lib/localization/format-preference"
import { currentScheduleDate, scheduleAt, type ScheduleRule } from "~/lib/calendar/availability"
import { useTRPC } from "~/lib/trpc/client"
import { TeamBreaksWeek } from "./team-breaks-week"
import { TeamPersonSection } from "./team-person-section"
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
  const personalHours = hours.data?.filter((rule) => rule.locationId === null) ?? []
  const useDefaults = hours.isSuccess && personalHours.length === 0
  const at = currentScheduleDate(business.timezone)
  const workingHours = scheduleAt<ScheduleRule>(useDefaults ? business.hours : personalHours, at)
  const currentBreaks = scheduleAt(breaks.data?.filter((rule) => rule.locationId === null) ?? [], at)
  const pending = breaks.isPending || hours.isPending || (useDefaults && business.isPending)
  const failed = breaks.isError || hours.isError || (useDefaults && business.isError)
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" : "en", includeDate: false, timeZone: "UTC" })

  return (
    <TeamPersonSection loadingLabel={pending ? t("people.loadingBreaks") : undefined} header={<TeamScheduleViewHeader title={t("people.breaks")} description={t("people.breaksDescription")} />}>
      {failed ? <Alert variant="error"><AlertTitle>{t("people.breaksError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={breaks.isFetching || hours.isFetching || business.isFetching} onClick={() => void Promise.all([breaks.refetch(), hours.refetch(), business.refetch()])} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : <TeamBreaksWeek rules={currentBreaks} workingDays={workingHours.filter((rule) => rule.isActive).map((rule) => rule.dayOfWeek)} renderTimes={(rule) => <span className="flex h-8 items-center text-sm tabular-nums">{formatTime(rule.startMinute)} – {formatTime(rule.endMinute)}</span>} />}
    </TeamPersonSection>
  )
}
