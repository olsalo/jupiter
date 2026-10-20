import { useQuery } from "@tanstack/react-query"
import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { upcomingTimeOff } from "~/lib/team-time-off"
import { useTRPC } from "~/lib/trpc/client"
import { TeamTimeOffList } from "./team-time-off-list"
import { Spinner } from "~/components/ui/spinner"

export function TeamUpcomingTimeOff({ staffMemberId, timezone, action }: { staffMemberId: string; timezone: string; action?: ReactNode }) {
  const { t } = useTranslation("team")
  const trpc = useTRPC()
  const titleId = useId()
  const timeOff = useQuery(trpc.availability.getTimeOff.queryOptions({ staffMemberId }))
  const entries = upcomingTimeOff(timeOff.data ?? [])

  return <section aria-labelledby={titleId} className="flex flex-1 flex-col gap-4">
    <div className="flex items-center justify-between gap-4"><h3 className="text-sm font-medium" id={titleId}>{t("timeOff.tab")}</h3>{action ? <span className="shrink-0">{action}</span> : null}</div>
    {timeOff.isPending ? <div className="flex flex-1 items-center justify-center py-6"><Spinner aria-label={t("timeOff.loading")} /></div> : timeOff.isError ? <Alert variant="error">
      <AlertTitle>{t("timeOff.loadError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription>
      <AlertAction><Button disabled={timeOff.isFetching} onClick={() => void timeOff.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
    </Alert> : entries.length === 0 ? <Empty className="min-h-0 w-full flex-1 border-0 bg-transparent px-4 py-3 md:px-4 md:py-3">
      <EmptyHeader className="mx-auto"><EmptyMedia className="mb-3" variant="icon"><Icon aria-hidden={true} name="calendarEvent" /></EmptyMedia><EmptyTitle className="text-sm">{t("timeOff.emptyUpcoming")}</EmptyTitle><EmptyDescription>{t("timeOff.emptyDescription")}</EmptyDescription></EmptyHeader>
    </Empty> : <TeamTimeOffList canManage={true} entries={entries} staffMemberId={staffMemberId} timezone={timezone} />}
  </section>
}
