import { Temporal } from "@js-temporal/polyfill"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { IconListItem } from "~/components/icon-list-item"
import { Badge } from "~/components/ui/badge"
import { formatDateTime } from "~/lib/format-preference"
import { readTimeOffRecurrence } from "~/lib/team-time-off"
import { TeamTimeOffActionsMenu } from "./team-time-off-actions-menu"

type TimeOffEntry = { id: string; title: string | null; startsAt: Date; endsAt: Date; recurrence: unknown }

export function TeamTimeOffList({ entries, staffMemberId, timezone, canManage }: {
  entries: TimeOffEntry[]
  staffMemberId: string
  timezone: string
  canManage: boolean
}) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
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

  return <ul className="flex flex-col gap-3">
    {entries.map((entry) => {
      const recurrence = readTimeOffRecurrence(entry.recurrence)
      return <IconListItem icon="calendarEvent" key={entry.id} actions={canManage ? <TeamTimeOffActionsMenu id={entry.id} title={entry.title || t("timeOff.tab")} staffMemberId={staffMemberId} repeating={Boolean(recurrence)} /> : null}>
        <span className="break-words text-sm font-medium">{entry.title || t("timeOff.tab")}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t(isAllDay(entry) ? "timeOff.allDay" : "timeOff.timed")}</Badge>
          {recurrence ? <Badge variant="outline">{t(`timeOff.repeatOptions.${recurrence.repeat}`)}</Badge> : null}
          <span className="text-xs leading-relaxed text-muted-foreground">{rangeLabel(entry)}</span>
          {recurrence ? <span className="text-xs text-muted-foreground">{recurrence.repeatUntil ? t("timeOff.repeatsUntil", { date: formatDateTime(new Date(Temporal.PlainDate.from(recurrence.repeatUntil).toZonedDateTime(recurrence.timezone).epochMilliseconds), { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" : "en", timeZone: recurrence.timezone, includeTime: false }) }) : t("timeOff.noEndDate")}</span> : null}
        </div>
      </IconListItem>
    })}
  </ul>
}
