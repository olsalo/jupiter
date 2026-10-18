import { useQuery } from "@tanstack/react-query"
import { Temporal } from "@js-temporal/polyfill"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import Icon from "~/components/icons"
import { IconListItem } from "~/components/icon-list-item"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { formatDateTime } from "~/lib/format-preference"
import { readTimeOffRecurrence } from "~/lib/team-time-off"
import { useTRPC } from "~/lib/trpc/client"
import { TeamPanelLoading } from "./team-panel-loading"
import { TeamTimeOffDialog } from "./team-time-off-dialog"
import { TeamTimeOffActionsMenu } from "./team-time-off-actions-menu"
import type { TeamPerson } from "./team-types"

export function TeamPersonTimeOff({ staff, canManage, self = false }: { self?: boolean; staff: NonNullable<TeamPerson["staff"]>; canManage: boolean }) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const timeOff = useQuery(trpc.availability.getTimeOff.queryOptions({ staffMemberId: staff.id }))
  const [open, setOpen] = useState(false)
  const [flow, setFlow] = useState(0)
  const timezone = staff.timezone ?? root?.organizationTimezone ?? "Europe/Helsinki"
  function add() {
    setFlow((value) => value + 1)
    setOpen(true)
  }
  const format = (date: Date) => formatDateTime(date, { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" : "en", timeZone: timezone })
  const isAllDay = (entry: { startsAt: Date; endsAt: Date }) => [entry.startsAt, entry.endsAt].every((date) => {
    const time = Temporal.Instant.fromEpochMilliseconds(+date).toZonedDateTimeISO(timezone)
    return time.hour === 0 && time.minute === 0 && time.second === 0 && time.millisecond === 0
  })
  const rangeLabel = (entry: { startsAt: Date; endsAt: Date }) => {
    const start = Temporal.Instant.fromEpochMilliseconds(+entry.startsAt).toZonedDateTimeISO(timezone)
    const end = Temporal.Instant.fromEpochMilliseconds(+entry.endsAt).toZonedDateTimeISO(timezone)
    if (isAllDay(entry)) {
      const options = { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" as const : "en" as const, timeZone: timezone, includeTime: false }
      const lastDay = end.subtract({ days: 1 })
      const firstLabel = formatDateTime(entry.startsAt, options)
      return `${firstLabel}${start.toPlainDate().equals(lastDay.toPlainDate()) ? "" : ` – ${formatDateTime(new Date(lastDay.epochMilliseconds), options)}`}`
    }
    return `${format(entry.startsAt)} – ${format(entry.endsAt)}`
  }
  const addButton = <Button onClick={add} size="sm" type="button" variant="outline"><Icon aria-hidden={true} name="plus" size={16} />{t("timeOff.add")}</Button>

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4">
      {!self || (canManage && Boolean(timeOff.data?.length)) ? <div className={self ? "flex justify-end" : "flex items-start justify-between gap-4"}>
        {!self ? <div><h3 className="text-sm font-medium">{t("timeOff.tab")}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("timeOff.description")}</p></div> : null}
        {canManage && Boolean(timeOff.data?.length) ? addButton : null}
      </div> : null}
      {timeOff.isPending ? <TeamPanelLoading label={t("timeOff.loading")} /> : timeOff.isError ? (
        <Alert variant="error"><AlertTitle>{t("timeOff.loadError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={timeOff.isFetching} onClick={() => void timeOff.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert>
      ) : timeOff.data.length === 0 ? (
        <Empty className="min-h-64 w-full border-0 bg-transparent">
          <EmptyHeader><EmptyMedia variant="icon"><Icon aria-hidden={true} name="calendarEvent" /></EmptyMedia><EmptyTitle>{t("timeOff.empty")}</EmptyTitle><EmptyDescription>{t(canManage ? "timeOff.emptyDescription" : "people.readOnly")}</EmptyDescription></EmptyHeader>
          {canManage ? <EmptyContent>{addButton}</EmptyContent> : null}
        </Empty>
      ) : (
      <ul className="flex flex-col gap-3">
          {timeOff.data.map((entry) => {
            const recurrence = readTimeOffRecurrence(entry.recurrence)
            return <IconListItem icon="calendarEvent" key={entry.id} actions={canManage ? <TeamTimeOffActionsMenu id={entry.id} title={entry.title || t("timeOff.tab")} staffMemberId={staff.id} repeating={Boolean(recurrence)} /> : null}>
              <span className="break-words text-sm font-medium">{entry.title || t("timeOff.tab")}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(isAllDay(entry) ? "timeOff.allDay" : "timeOff.timed")}</Badge>
                {recurrence ? <Badge variant="outline">{t(`timeOff.repeatOptions.${recurrence.repeat}`)}</Badge> : null}
                <span className="text-xs leading-relaxed text-muted-foreground">{rangeLabel(entry)}</span>
                {recurrence ? <span className="text-xs text-muted-foreground">{recurrence.repeatUntil ? t("timeOff.repeatsUntil", { date: formatDateTime(new Date(Temporal.PlainDate.from(recurrence.repeatUntil).toZonedDateTime(recurrence.timezone).epochMilliseconds), { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" : "en", timeZone: recurrence.timezone, includeTime: false }) }) : t("timeOff.noEndDate")}</span> : null}
              </div>
          </IconListItem>})}
        </ul>
      )}
      {canManage ? <TeamTimeOffDialog self={self} flow={flow} onOpenChange={setOpen} open={open} staffMemberId={staff.id} timezone={timezone} /> : null}
    </div>
  )
}
