import { memo } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Card } from "~/components/ui/card"
import { formatDateTime, type FormatPreference } from "~/lib/localization/format-preference"
import { cn } from "~/lib/utils"

type BreakPeriod = { startMinute: number; endMinute: number }

export const CalendarBreakCard = memo(function CalendarBreakCard({ period, startMinute, endMinute, formatPreference, horizontal = false }: {
  period: BreakPeriod
  startMinute: number
  endMinute: number
  formatPreference: FormatPreference
  horizontal?: boolean
}) {
  const { t, i18n } = useTranslation()
  const start = Math.max(startMinute, period.startMinute)
  const end = Math.min(endMinute, period.endMinute)
  if (end <= start || endMinute <= startMinute) return null
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const time = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference, language, timeZone: "UTC", includeDate: false })
  const timeLabel = `${time(period.startMinute)} – ${time(period.endMinute)}`
  const label = t("calendarGrid.break")
  const duration = end - start

  return <Card
    aria-label={`${label} · ${timeLabel}`}
    className={cn("absolute inset-x-1 z-5 cursor-default select-none gap-0 overflow-hidden rounded-md border-[#9b6a47]/40 bg-[#9b6a47]/12 px-2 py-1 text-[#714b33] dark:border-[#c49370]/40 dark:bg-[#c49370]/18 dark:text-[#ddb594] shadow-none before:hidden", !horizontal && duration < 30 && "py-0.5")}
    data-slot="calendar-break"
    draggable={false}
    onDragStart={(event) => event.preventDefault()}
    render={<article />}
    style={horizontal ? {
      left: `calc(${(start - startMinute) / (endMinute - startMinute) * 100}% + 2px)`,
      width: `calc(${duration / (endMinute - startMinute) * 100}% - 4px)`,
      right: "auto", top: 4, bottom: 4,
    } : {
      top: `${(start - startMinute) / (endMinute - startMinute) * 100}%`,
      height: `calc(${duration / (endMinute - startMinute) * 100}% - 4px)`,
      left: "var(--calendar-card-inset, 4px)", right: "var(--calendar-card-inset, 4px)",
    }}
  >
    <span className="flex items-center gap-1 truncate text-xs font-medium leading-4"><Icon aria-hidden={true} className="shrink-0" name="coffee" size={14} />{label}</span>
    {horizontal || duration >= 30 ? <span className="truncate text-[10px] leading-3 tabular-nums">{timeLabel}</span> : null}
  </Card>
})
